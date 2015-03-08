
var thisTab = null,
    
    getBackground = (function(){
        var bg = null;
        return function(){
            return bg === null ? bg = chrome.extension.getBackgroundPage() : bg;
        };
    })(),

    
    utils = {

        interpolate : function(str, data){

            return str.replace(
                    /\{([^{}]*)\}/g,
                    function (a, b) {
                        var r = data[b];
                        return typeof r === 'string' || typeof r === 'number' ? r : a;
                    }
                );
        },

        escapeHTML : function(str){
            // for escaping purposes we will have the 
            // browser use it's native escaping features of the
            // createTextNode
            var div = document.createElement('div');
            div.appendChild(document.createTextNode(str));
            return div.innerHTML;
        }
    },

    find = {
        one: function(selector){
            return document.querySelector(selector);
        },
        all: function(selector){
            return document.querySelectorAll(selector);
        }
    },

    templates = (function(){
        var _cache = {};

        return {
            preCacheTemplate: function(templateId) {
                var src = document.getElementById(templateId);

                if(!(templateId in _cache)){
                    _cache[templateId] = src.innerHTML;
                }

                return _cache[templateId];
            },

            getPopulatedHTML: function(templateId, data) {
                var template = templates.preCacheTemplate(templateId, data);
                return utils.interpolate(template, data || {});
            }
        };
    })(),
    
    
    resolveOrigin = function(type, data){
        
        var origin = '',
            hashIndex,
            noOriginUrl = data.url === '',
            tabUrl = thisTab.url,
            pathSegments,
            background = getBackground();
        
        if(type === 'JS_ERROR'){
            
            // strip the hash fragment because when comparing the urls
            // the error.url will not contain the fragment
            hashIndex = tabUrl.indexOf('#');
            tabUrl = hashIndex > -1 ? tabUrl.substr(0, hashIndex) : tabUrl;

            
            if(tabUrl === data.url){
                // see if this error came from a content script caused this error
                origin = 'in an embedded script';

            }else if( !noOriginUrl && data.fromIframe ){

                origin = 'in an iframe';

            } else if( data.error.toLowerCase() === 'script error.'){
                // "Script error." is the message that is thrown when 
                // an external src, that is not from the domain as the host
                // With local files, all files are treated as different domains
                

                if(data.fromIframe && noOriginUrl && background.utils.getHostKey(data.iframeUrl) !== tabUrl){
                    // Note: this can also happen if the iframe url is of a differnt
                    // domain than the host as well
                    origin = 'in a cross origin iframe';
                }else {
                    origin = 'in an external script';
                }

            }else if( !noOriginUrl ){
                
                // get the file that caused the error
                pathSegments = data.url.split('/');
                origin = 'in ' + pathSegments[pathSegments.length - 1];
            }

            if(data.fromIframe && data.iframeName){
                origin += ' named "' + data.iframeName + '"';
            }

            if(!noOriginUrl){
                // add in the line and col numbers if we know it
                if( data.line ){
                    origin += ' on line: ' + data.line;
                }
                if( data.column ){
                    origin += ' col: ' + data.column;
                }
            }
        }
        
        return origin;
    },

    // for a given item, the data may justify 
    // having multiple types of classes applied
    // for styling, this is to account for that
    getItemClasses = function(data){

        var classes = [],
            stackAry = data.stack ? data.stack.split('\n') : [];

        // callstack verbose info will gave a toggle arrow
        if(stackAry.length > 1){
            classes.push('toggle_stack');
        }


        return classes.join(' ');
    },


    // build the stack data
    // this includes creating the links to the origin url
    buildStackInfo = function(data){

        if(!data.stack){
            return 'Callstack information not provided when error occured';
        }

        var stack = data.stack.split('\n');


        stack = stack.map(function(item, index){

            // only style stack items if this is not the 
            // first reason in the call stack
            if(index === 0){

                // if this is the only callstack entry we need
                // to link it to the source if we have the url
                if( data.url && stack.length === 1){
                    item = '<a href="view-source:' + data.url.replace(/[\/\\]/, '') + '" target="_blank">' + utils.escapeHTML(item) + '</a>';
                }else {
                    item = utils.escapeHTML(item);
                }

                return '<div class="stack_error"> <div class="arrow"></div>' + item + '</div>';
            }

            return '<div class="stack_item">' + utils.escapeHTML(item) + '</div>';
        });


        // add link to the 2nd reason entry in the 
        // call stack. But only do it if we have a good match on it
        if(data.url && stack.length > 1 && stack[1].indexOf(data.url) >= 0){
            stack[1] = stack[1].replace(data.url, '<a href="view-source:' + data.url.replace(/[\/\\]/, '') + '" target="_blank">' + data.url + '</a>');
        }

        return stack.join('');
    },

    setBodyWidth = function(longestLineLength){
        // 7 handles our large string case well
        // until we run into an issue with sizing being
        // too far off, we will settle with this to reduce
        // the the need to calculate it
        find.one('body').style.width = longestLineLength * 7 + 'px';
    },

    calcMinWidth = function(data){
        var stackAry = data.stack ? data.stack.split('\n') : [],
            longest;

        if(stackAry.length === 0){
            return 0;
        }

        // callstack verbose info will gave a toggle arrow
        longest = stackAry.reduce(function(prev, current){
                return prev.length > current.length ? prev : current;
            }) || '';

        return longest.length || 0;
    },


    
    populateInterface = function(host, errors){
        
        var header = find.one('header'),
            errorsContainer,
            itemsHTML = '',
            bodyWidth = 0;
        
        // Add the header information
        header.querySelector('[data-host]').innerHTML = utils.escapeHTML(host);
        
        
        // no errors message
        if(!errors || errors.length === 0){

            find.one('.errors_container').insertAdjacentHTML('afterbegin', templates.getPopulatedHTML('template--no-errors'));
            find.one('[data-no-errors]').classList.remove('hide');
            return;
        }
        
        // we have errors, display them 
        errorsContainer = find.one('[data-error-list]');
        
        errors.map(function(errorData){

            // calculate what the browser size should be            
            bodyWidth = Math.max(bodyWidth, calcMinWidth(errorData.data));

            // build the actual list items
            itemsHTML += templates.getPopulatedHTML('template--error-list-item', {
                errorType: 'Error',
                origin: resolveOrigin(errorData.type, errorData.data),
                stack: buildStackInfo(errorData.data),
                column: errorData.data.column,
                line: errorData.data.line,
                errorName: errorData.data.name || '',
                occurance: errorData.occurance <= 1 ? '' : errorData.occurance > 99 ? '99+' : errorData.occurance + 'x',
                occuranceTitle: errorData.occurance <= 1 ? '' : 'thrown ' + errorData.occurance + ' times',
                iframeUrl: (errorData.data.fromIframe && errorData.data.iframeUrl) ? ' (iframe url: ' + errorData.data.iframeUrl + ')' : '',
                itemClasses: getItemClasses(errorData.data)
            });
        });

        setBodyWidth(bodyWidth);

        errorsContainer.innerHTML = itemsHTML;
        errorsContainer.classList.remove('hide');
    },

    bindEvents = function(){

        var _bind = function(el){
            return Gator(find.one(el));
        };


        // toggle call stack visibility
        _bind('.errors_list').on('click', '.toggle_stack .stack_error', function(){
            var callStackContent = this.parentElement;

            if(callStackContent.classList.contains('show_stack')){
                this.parentElement.classList.remove('show_stack');
            }else {
                this.parentElement.classList.add('show_stack');
            }
        });

    };





// The popup is completely destroyed and remade upon
// clicking the browserAction and clicking off the pop up
// So we can rely on this to know when the user is engaging with
// the extension
document.addEventListener('DOMContentLoaded', function () {
    
    var background = getBackground(),
        currentTab;
    
    // grab the currently open tab
    chrome.tabs.query({active:true, currentWindow: true}, function(tabs){
        
        var host,
            errors,
            tab = tabs.length > 0 ? tabs[0] : null;
        
        // populate the global tab access
        thisTab = tab;

        if( tab ){

            hostKey = background.utils.getHostKey(tab.url);
            errors = background.errorStorage.get(hostKey, tab.id) || {};
            populateInterface(hostKey, errors.errors);
            bindEvents();

            if(errors.errors.length > 0){
                background.markAsSeen(tab.id);
            }
        }
    });
});



