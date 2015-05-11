

var utils = {

        // We need a key to link errors to hosts so we use this
        // utility to take a given url, grab the host name to the
        // best of our ability and we use it to create a key
        getHostKey : function( url ){

            var segments = (url.split('?').shift()).split(':'),
                scheme = segments.shift(),
                paths = segments.shift().split('/'),
                host = '';

            // remove the initial empty paths
            while( paths.length > 0 && paths[0] === '' ){
                paths.shift();
            }

            // handle the common case of http and https
            if( scheme === 'http' || scheme === 'https' ){

                host = paths.length > 0 ? paths[0] : '';

            }else if( scheme === 'file' || scheme === 'chrome' ){

                // for local file locations
                // we don't have a domain so we will use
                // the folder name of the farthest right as the domain
                if( paths.length > 0 ){
                    host = paths.length === 1 ? paths[0] : paths.splice(paths.length - 2, 2).join('/');
                }
            }

            return host !== '' ? host : 'EMPTY_HOST';
        },

        log : function(){
            console.log.apply(console, arguments);
        }
    },


    /*
        The idea behind having the storage of this data is for catching errors on unload events.
        Currently we are not catching those types of errors but we will soon enough :)
    */
    errorStorage = (function(){

        var CLIENT_ERRORS_KEY = '__ErrorAnnex__',
            _clientErrors = JSON.parse(localStorage.getItem(CLIENT_ERRORS_KEY) || '{}'),
            _update = function(){
                localStorage.setItem(CLIENT_ERRORS_KEY, JSON.stringify(_clientErrors));
            };

        return {

            set : function( host, errorInfo ){
                _clientErrors[host] = errorInfo;
                _update();
            },

            /*
                We set error notifications based on host name key but
                we pull them with the host name + tab id combo
            */
            get : function( host, tabId ){

                var errors = (_clientErrors[ host ] && _clientErrors[ host ].errors) || [],
                    tabErrors = { errors: [] };

                errors.forEach(function(er){

                    if( er.tabId === tabId ){
                        tabErrors.errors.push(er);
                    }
                });

                return tabErrors;
            },

            /*
                prerendering and other tab replace type events can
                cause the tab id to change. We need to keep it synced up
                whenever the replacement happens
            */
            updateTabId : function( host, oldTabId, newTabId){
                
                console.log('update tabid from', oldTabId, 'to', newTabId);

                var errors = (_clientErrors[ host ] && _clientErrors[ host ].errors) || [];

                errors.forEach(function(er){
                    if(er.tabId === oldTabId){
                        er.tabId = newTabId;
                    }
                });

                _update();
            },

            remove : function( host, tabId ){

                var errors = (_clientErrors[ host ] && _clientErrors[ host ].errors) || [],
                    origLength = errors.length;

                errors.forEach(function(er, index, clientErrors){
                    if(er.tabId === tabId){
                        clientErrors.splice(index, 1);
                    }
                });
                // this cleans up a host from our storage 
                if( errors.length === 0 ){
                    delete _clientErrors[ host ];
                }
                
                if(errors.length !== origLength){
                    _update();
                }
            },

            purgeErrors : function(){
                _clientErrors = {};
                localStorage.removeItem(CLIENT_ERRORS_KEY);
            }
        };
    })(),

    /**
        Add to local memory, the association between an error and a host site
    */
    addErrorForHost = function( host, tabId, type, data ){

        var i,
            errorInfo,
            duplicate = false,
            errorsForHost = errorStorage.get( host, tabId ) || {
                    errors : []
                };


        // DUPLICATE CHECKING
        // using the correct combination of properties
        // see if this error is another occurance of a previous error
        if( type === 'JS_ERROR'){

            for(i = 0; i < errorsForHost.errors.length && !duplicate; i++){
                
                errorInfo = errorsForHost.errors[i];

                if( errorInfo.tabId === tabId &&
                    errorInfo.data.error === data.error &&
                    errorInfo.data.stack === data.stack &&
                    errorInfo.data.fromIframe === data.fromIframe ){

                    // todo: edgecase, we have multiple iframes on a given

                    duplicate = true;
                    errorsForHost.errors[i].occurance++;
                }
            }
        }

        // Add new error if it wasn't a duplicate
        if( !duplicate ){
            errorsForHost.errors.push({
                tabId : tabId,
                type : type,
                data : data,
                timeStamp : new Date(),
                occurance : 1
            });
        }

        // Save the new collection
        errorStorage.set(host, errorsForHost);
    },


    // we have had some issues where an event will 
    // be triggered for a "tab" that we dont have access to.
    // so we will use this utility to always filter what we
    // have access to by the id given
    queryTabById = function(tabId, cb){
        chrome.tabs.query({}, function(tabs){
            var tabMatch = tabs.filter(function(tab){
                    return tab.id === tabId;
                });

            if(tabMatch.length > 0){
                cb(tabMatch[0]);
            }
        });
    },


    // note this is used in a place that accepts a generic
    // callback, so we need to make sure the message is actually
    // given to us for our error handling -- otherwise we console.error
    // lots of undefined values
    runtimeErrorHandler = function(message){
        if(message !== undefined && chrome.runtime.lastError !== undefined){
            console.error('CAUGHT RUNTIME ERROR',
                message, chrome.runtime.lastError,
                '\nnote: this is logged for reference');   
        }
    },

    // show the user indication that there has been
    // a new error caught
    sendNotifications = function(hostKey, tabId){
        
        queryTabById(tabId, function(tab){

            chrome.browserAction.setIcon( { path: {
                19: "icons/icon19.png",
                38: "icons/icon38.png"
            }, tabId: tab.id }, runtimeErrorHandler );

            notifications.show(hostKey, tabId, "Errors on " + hostKey, "New JavaScript Errors have occured.");
        });
    },

    // upon navigation, make sure we clear up any 
    // currently visible error state - new or read
    suppressNotifications = function(tabId, sender){

        queryTabById(tabId, function(tab){
            chrome.browserAction.setIcon( { path: {
                19: "icons/icon19_d.png",
                38: "icons/icon38_d.png"
            }, tabId: tab.id }, runtimeErrorHandler);

            notifications.close(utils.getHostKey(tab.url), tab.id);
        });
    },

    // when the user opens the browser action
    // mark this as a "seen" error state
    markAsSeen = function(tabId){

        queryTabById(tabId, function(tab){
            chrome.browserAction.setIcon( { path: {
                19: "icons/icon19_p.png",
                38: "icons/icon38_p.png"
            }, tabId: tab.id }, runtimeErrorHandler);

            notifications.close(utils.getHostKey(tab.url), tab.id);
        });
    },


    options = (function(){

        var _opts = {
            allDomainNotes: false,
            domainNotes: []
        };

        chrome.storage.sync.get(_opts, function(syncedOptions) {
            _opts = syncedOptions;
        });

        chrome.storage.onChanged.addListener(function(changes, storageType) {

            var defined = function(val){
                    return val !== undefined;
                };

            if(storageType !== 'sync'){
                return;
            }

            if(defined(changes.allDomainNotes)){
                _opts.allDomainNotes = changes.allDomainNotes.newValue;
            }

            if(defined(changes.domainNotes)){
                _opts.domainNotes = changes.domainNotes.newValue;
            }
        });

        return {
            get: function(){
                return _opts;
            }
        };
    })(),

 
    notifications = (function(){

        var CLIENT_NOTES_KEY = '__ErrorAnnex_Notifications__',

            // the time between showing the notification and it being
            // closed because of no action. This time tells us how long
            // we give a "visible" state note before we will show another
            FADE_OUT_THRESHOLD = 6000,

            _clientNotes = JSON.parse(localStorage.getItem(CLIENT_NOTES_KEY) || '{}'),
        
            _update = function(){
                localStorage.setItem(CLIENT_NOTES_KEY, JSON.stringify(_clientNotes));
            },
        
            _markAsClosed = function(id){

                // since we use a storage id that is different
                // from the notification id, we need to resolve the
                // correct storage id based on that note id
                var storageId = id.split('*').shift();

                delete _clientNotes[storageId];

                _update();
            },

            // see if enought time has passed that we thing the
            // notification would have timed out by the system
            _timeElapseCheck = function(shownTime, currentTime){
                return currentTime - shownTime < FADE_OUT_THRESHOLD;
            },
           
            _globalId = 0;


        // clean up note states
        chrome.notifications.onClosed.addListener(_markAsClosed);
        chrome.notifications.onClicked.addListener(_markAsClosed);

        return {

            canShow: function(hostKey){

                utils.log(options.get(), options.get().allDomainNotes, options.get().domainNotes, (options.get().domainNotes || []).indexOf(hostKey) > -1);

                return options.get().allDomainNotes || (options.get().domainNotes || []).indexOf(hostKey) > -1;
            },

            show: function(hostKey, tabId, title, message){

                if(!this.canShow(hostKey)){
                    return;
                }

                var storageId = hostKey + '-' + tabId,

                    // using star as an easy split point to get storageId
                    noteKey = storageId + '*' + _globalId++,
                    noteState = _clientNotes[storageId] || {},
                    now = Date.now();

                // is the current note state visible?
                if(noteState.visible && _timeElapseCheck(noteState.notedTime, now)){
                    return;
                }
                
                // we are good to go on creating a notification
                noteState.visible = true;
                noteState.notedTime = now;
                _clientNotes[storageId] = noteState;
                _update();

                chrome.notifications.create(

                    // we need a unique key for this
                    // particular host/tab combo
                    noteKey,
                    {
                        type: 'basic',
                        iconUrl: 'icons/icon38.png',
                        title: title,
                        message: message
                    },
                    function createdCb(){ });
            },

            purgeNotes: function(){
                _clientNotes = {};
                localStorage.removeItem(CLIENT_NOTES_KEY);
            },

            close: function(hostKey, tabId){
                
                var storageId = hostKey + '-' + tabId;

                // TODO: only perform this if we support 
                // notifications for this hostKey

                // find the notification based on the 
                // storageId and clear it
                chrome.notifications.getAll(function(notes){
                    var key, id;

                    for(key in notes){
                        id = key.split('*').shift();
                        if(id === storageId){
                            chrome.notifications.clear(key);
                        }
                    }
                });
            }
        };

    })();







/*********************
Chrome Listeners
*********************/

// on installing the extension, completely purge the legacy data
chrome.runtime.onInstalled.addListener(function(details){
    if( details.reason === 'update'){
        errorStorage.purgeErrors();
        notifications.purgeNotes();
    }
});

chrome.runtime.onStartup.addListener(function() {
    // look into
});

// listen to errors from the content scripts
chrome.runtime.onMessage.addListener( function(message, sender, sendResponse) {

    // only process when we have a url
    if(!sender.tab || !sender.tab.url){
        return;
    }

    var hostKey = utils.getHostKey(sender.tab.url),
        data = JSON.parse(message);


    if(data.error){
        addErrorForHost(hostKey, sender.tab.id, 'JS_ERROR', data);
        sendNotifications(hostKey, sender.tab.id);
    }else if(data.tabUpdate && data.tabUpdate === 'full-page-load'){
        errorStorage.remove(hostKey, sender.tab.id);
        suppressNotifications(sender.tab.id);
    }
});

// we track the errors for a given tab by the tab id
// but these ids can be replaced so we need to update them
// with the correct ids
chrome.webNavigation.onTabReplaced.addListener(function (details){
    queryTabById(details.tabId, function(tab){
        errorStorage.updateTabId(utils.getHostKey(tab.url), details.replacedTabId, details.tabId);
    });
});




// TODO: explore if this makes more sense than content script message
// chrome.webNavigation.onCompleted.addListener(function (details){});


/**

For now, network errors will be tabled and JavaScript errors will
be given the focus.


chrome.webRequest.onErrorOccurred.addListener(function(error){

    // We need to do exactly what
    // the spec says not to do. We need
    // to parse through the error to decipher what
    // type of error it is.

    if( error.url.indexOf('chrome-extension://') > -1){
        return;
    }

    // We need to get the correct url for the tab
    // to correctly link the hostKey
    queryTabById(error.tabId, function(tab){
        var hostKey = utils.getHostKey(tab.url);

        errorStorage.addErrorForHost(hostKey, 'NETWORK_ERROR', {
            requestedUrl : error.url,
            type: error.type,
            error : error.error,
            fromCache : error.fromCache,
            url : tab.url
        });

        sendNotifications(tab.id);
    });

},{ urls: ["<all_urls>"] });

*/
