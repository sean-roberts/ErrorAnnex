// Note: we have a problem with an error occuring on 
// one tab, then opening the same url on a different tab
// will erase the error


var thisTab = null,
    
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
        
        var origin = 'todo',
            hashIndex,
            tabUrl = thisTab.url,
            pathSegments;
        
        if(type === 'JS_ERROR'){
            
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
            }else {
                
                // get the file that caused the error
                pathSegments = data.url.split('/');
                origin = 'in ' + pathSegments[pathSegments.length - 1];
                
            }
            
            if( data.line ){
                origin += ' on line: ' + data.line;
            }
            
            if( data.column ){
                origin += ' col: ' + data.column;
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
                errorType: errorData.type === 'JS_ERROR' ? 'JS Error' : 'Network Error',
                origin: resolveOrigin(errorData.type, errorData.data),
                stack: stackInfo,
                column: errorData.data.column,
                line: errorData.data.line,
                errorName: errorData.data.errorName || '',
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
    var background = chrome.extension.getBackgroundPage(),
        currentTab;
    
    chrome.tabs.query({active:true, currentWindow: true}, function(tabs){
        
        var host,
            errors,
            tab = tabs.length > 0 ? tabs[0] : null;
        
        // populate the global tab access
        thisTab = tab;
        
        if( tab ){
            
            //setTimeout(function(){
                
            hostKey = background.utils.getHostKey(tab.url);
            errors = background.errorStorage.get(hostKey, tab.id) || {};
            populateInterface(hostKey, errors.errors);
            //}, 3000);
        }
        
    });
});