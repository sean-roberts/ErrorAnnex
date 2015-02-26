
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
        }
    },
    
    
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


    // build the stack data
    // this includes creating the links to the origin url
    buildStackInfo = function(data){

        if(!data.stack){
            return 'Callstack information not provided when error occured';
        }

        var stack = data.stack.split('\n'),
            jumpHash = '#ErrorAnnex';

        if( data.line ){
            jumpHash += '&line' + data.line;
        }
        if( data.column ){
            jumpHash += '&column' + data.column;
        }


        if(data.url && stack.length > 0){
            stack[0] = '<a href="view-source:' + data.url.replace(/[\/\\]/, '') + jumpHash + '" target="_blank">' + stack[0] + '</a>';
        }

        return stack.join('<br />');
    },
    
    populateInterface = function(host, errors){
        
        var i,
            header = document.querySelector('header'),
            errorData,
            errorsContainer,
            itemTemplate,
            itemsHTML = '';
        
        // Add the header information
        header.querySelector('[data-host]').innerHTML = host;
        
        
        // no errors message
        if(!errors || errors.length === 0){
            document.querySelector('[data-no-errors]').classList.remove('hide');
            return;
        }
        
        // we have errors, display them 
        errorsContainer = document.querySelector('[data-error-list]');
        itemTemplate = errorsContainer.innerHTML.trim();
        
        for(i = 0; i < errors.length; i++){
            
            errorData = errors[i];
            
            itemsHTML += utils.interpolate(itemTemplate, {
                errorType: 'JS Error',
                origin: resolveOrigin(errorData.type, errorData.data),
                stack: buildStackInfo(errorData.data),
                column: errorData.data.column,
                line: errorData.data.line,
                errorName: errorData.data.name || '',
                occurance: errorData.occurance <= 1 ? '' : 'thrown ' + errorData.occurance + ' times',
                iframeUrl: (errorData.data.fromIframe && errorData.data.iframeUrl) ? ' (iframe url: ' + errorData.data.iframeUrl + ')' : ''
            });
        }
        
        errorsContainer.innerHTML = itemsHTML;
        errorsContainer.classList.remove('hide');
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
        }
        
    });
});