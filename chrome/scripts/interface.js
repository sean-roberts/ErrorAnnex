
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
    
    /**
        TODO: investigate iframe originating errors
    */
    resolveOrigin = function(type, data){
        
        var origin = 'No info on where error originated from.  :(',
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
            
            // see if this error came from a content script caused this error
            if(tabUrl === data.url){
                origin = 'in an embedded script';
            } else if( data.error.toLowerCase() === 'script error.'){
                // "Script error." is the message that is thrown when 
                // an external src, that is not from the domain as the host
                // With local files, all files are treated as different domains

                origin = 'in an external script';
            }else if( !noOriginUrl ){
                
                // get the file that caused the error
                pathSegments = data.url.split('/');
                origin = 'in ' + pathSegments[pathSegments.length - 1];
            }else {
                // NOTE: we are making a big assumption here that
                // when there is no data.url and the 'script error.' wasn't seen
                // that this was from a script from a terminal on the page
                background.utils.log('You were notified of an error that was from the console.',
                'We made some assumptions that this was likely where the error came from.',
                'File a report please if you have a use case that invalidates these assumptions');

                origin = 'in a console script';
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
    
    
    
    
    populateInterface = function(host, errors){
        
        var i,
            header = document.querySelector('header'),
            errorData,
            errorsContainer,
            itemTemplate,
            itemsHTML = '',
            stackInfo = '';
        
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
            
            stackInfo = !errorData.data.stack ? 'Callstack information not provided when error occured' : errorData.data.stack.split('\n').join('<br />');
            
            itemsHTML += utils.interpolate(itemTemplate, {
                errorType: 'JS Error',
                origin: resolveOrigin(errorData.type, errorData.data),
                stack: stackInfo,
                column: errorData.data.column,
                line: errorData.data.line,
                errorName: errorData.data.name || '',
                occurance: errorData.occurance <= 1 ? '' : 'thrown ' + errorData.occurance + ' times'
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