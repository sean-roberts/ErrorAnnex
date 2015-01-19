



/**

To catch general JS errors we will override the onerror for the
window. It may be optional to have the console.error message presented
in this prompt as well.

To help get errors in the unload phase we will try to listen for
unload event listener assignment and store any errors that happen
in that function. Then we will present the error upon the next time
they open the extension.

*/




var utils = {

        // We need a key to link errors to hosts so we use this
        // utility to take a given url, grab the host name to the
        // best of our ability and we use it to create a key
        getHostKey : function( url ){

            var segments = url.split(':'),
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

    errorStorage = (function(){

        var CLIENT_ERRORS_KEY = '__ErrorAnnex__',
            _clientErrors = JSON.parse(localStorage.getItem(CLIENT_ERRORS_KEY) || '{}');

        return {

            set : function( host, errorInfo ){
                _clientErrors[host] = errorInfo;
                localStorage.setItem(CLIENT_ERRORS_KEY, JSON.stringify(_clientErrors));
            },

            /*
                We set error notifications based on host name key but
                we pull them with the host name + tab id combo
            */
            get : function( host, tabId ){

                var i,
                    errors = (_clientErrors[ host ] && _clientErrors[ host ].errors) || [],
                    tabErrors = { errors: [] };

                for(i = 0; i < errors.length; i++){
                    if( errors[i].tabId === tabId ){
                        tabErrors.errors.push(errors[i]);
                    }
                }

                return tabErrors;
            },

            remove : function( host, tabId ){

                var i,
                    clientError = _clientErrors[ host ],
                    errors,
                    newErrors = [];

                if( clientError ){
                    errors = clientError.errors || [];
                    for( i = 0; i < errors.length; i++){
                        if(errors[i].tabId !== tabId){
                            newErrors.push(errors[i]);
                        }
                    }
                    clientError.errors = newErrors;
                }

                if( newErrors.length === 0 ){
                    delete _clientErrors[ host ];
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


        // using the correct combination of properties
        // see if this error is another occurance of a previous error
        if( type === 'JS_ERROR'){
            for(i = 0; i < errorsForHost.errors.length && !duplicate; i++){
                errorInfo = errorsForHost.errors[i];
                if(
                    errorInfo.tabId === tabId &&
                    errorInfo.data.error === data.error &&
                    errorInfo.data.stack === data.stack
                  ){
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

    notify = function(tabId){
        
        // TODO: set up chrome notifications option

        chrome.browserAction.setBadgeText({
            text : 'error',
            tabId: tabId
        });
    };







/*********************
Chrome Listeners
*********************/

// on installing the extension, completely purge the legacy data
chrome.runtime.onInstalled.addListener(function(details){
    if( details.reason === 'update'){
        errorStorage.purgeErrors();
    }
});

// listen to errors from the content scripts
chrome.runtime.onMessage.addListener( function(message, sender, sendResponse) {
    var hostKey = utils.getHostKey(sender.tab.url);

    addErrorForHost(hostKey, sender.tab.id, 'JS_ERROR', JSON.parse(message));
    
    notify(sender.tab.id);
});

// when the tab is refreshed remove all the tabs errors
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab){
    var hostKey = utils.getHostKey(tab.url);

    // This tab is refreshing -- blow away the errors for this tab
    if(changeInfo.status === 'loading'){
        errorStorage.remove(hostKey, tabId);
    }
});



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
    // to correctly link the hostkey
    chrome.tabs.get(error.tabId, function(tab){
        var hostKey = utils.getHostKey(tab.url);

        errorStorage.addErrorForHost(hostKey, 'NETWORK_ERROR', {
            requestedUrl : error.url,
            type: error.type,
            error : error.error,
            fromCache : error.fromCache,
            url : tab.url
        });

        notify(tab.id);
    });

},{ urls: ["<all_urls>"] });

*/
