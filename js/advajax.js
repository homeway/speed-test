/*
 * AdvancedAJAX 1.1.2
 * (c) 2005-2006 Lukasz Lach
 *  mail: anakin@php5.pl
 *  www:  http://advajax.anakin.us/
 *        http://anakin.us/
 * http://creativecommons.org/licenses/LGPL/2.1/
 *
 */

function advAJAX() {

    var obj = new Object();

    obj.url = window.location.href;
    obj.method = "GET";
    obj.parameters = new Object();
    obj.jsonParameters = new Object();
    obj.headers = new Object();
    obj.async = true;
    obj.mimeType = "text/xml";
    obj.username = null;
    obj.password = null;
    obj.form = null;
    obj.disableForm = true;

    obj.unique = true;
    obj.uniqueParameter = "_uniqid";

    obj.requestDone = false;
    obj.queryString = "";
    obj.responseText = null;
    obj.responseXML = null;
    obj.status = null;
    obj.statusText = null;
    obj.aborted = false;
    obj.timeout = 0;
    obj.retryCount = 0;
    obj.retryDelay = 1000;
    obj.tag = null;
    obj.group = null;
    obj.progressTimerInterval = 50;

    obj.xmlHttpRequest = null;

    obj.onInitialization = null;
    obj.onFinalization = null;
    obj.onReadyStateChange = null;
    obj.onLoading = null;
    obj.onLoaded = null;
    obj.onInteractive = null;
    obj.onComplete = null;
    obj.onProgress = null;
    obj.onSuccess = null;
    obj.onFatalError = null;
    obj.onError = null;
    obj.onTimeout = null;
    obj.onRetryDelay = null;
    obj.onRetry = null;
    obj.onGroupEnter = null;
    obj.onGroupLeave = null;

    obj.createXmlHttpRequest = function() {

        if (typeof XMLHttpRequest != "undefined")
            return new XMLHttpRequest();
        var xhrVersion = [ "MSXML2.XMLHttp.5.0", "MSXML2.XMLHttp.4.0","MSXML2.XMLHttp.3.0",
                "MSXML2.XMLHttp","Microsoft.XMLHttp" ];
        for (var i = 0; i < xhrVersion.length; i++) {
            try {
                var xhrObj = new ActiveXObject(xhrVersion[i]);
                return xhrObj;
            } catch (e) { }
        }
        obj.raiseEvent("FatalError");
        return null;
    };

    obj._oldResponseLength = null;
    obj._progressTimer = null;
    obj._progressStarted = navigator.userAgent.indexOf('Opera') == -1;
    obj._onProgress = function() {

        if (typeof obj.onProgress == "function" &&
            typeof obj.xmlHttpRequest.getResponseHeader == "function") {
            var contentLength = obj.xmlHttpRequest.getResponseHeader("Content-length");
            if (contentLength != null && contentLength != '') {
                var responseLength = obj.xmlHttpRequest.responseText.length;
                if (responseLength != obj._oldResponseLength) {
                    obj.raiseEvent("Progress", obj, responseLength, contentLength);
                    obj._oldResponseLength = obj.xmlHttpRequest.responseText.length;
                }
            }
        }
        if (obj._progressStarted) return;
        obj._progressStarted = true;
        var _obj = this;
        this.__onProgress = function() {
            obj._onProgress();
            obj._progressTimer = window.setTimeout(_obj.__onProgress, obj.progressTimerInterval);
        }
        _obj.__onProgress();
    }

    obj._onInitializationHandled = false;
    obj._initObject = function() {

        if (obj.xmlHttpRequest != null) {
            delete obj.xmlHttpRequest["onreadystatechange"];
            obj.xmlHttpRequest = null;
        }
        if ((obj.xmlHttpRequest = obj.createXmlHttpRequest()) == null)
            return null;
        if (typeof obj.xmlHttpRequest.overrideMimeType != "undefined")
            obj.xmlHttpRequest.overrideMimeType(obj.mimeType);
        obj.xmlHttpRequest.onreadystatechange = function() {

            if (obj == null || obj.xmlHttpRequest == null)
                return;
            obj.raiseEvent("ReadyStateChange", obj, obj.xmlHttpRequest.readyState);
            obj._onProgress();
            switch (obj.xmlHttpRequest.readyState) {
                case 1: obj._onLoading(); break;
                case 2: obj._onLoaded(); break;
                case 3: obj._onInteractive(); break;
                case 4: obj._onComplete(); break;
            }
        };
        obj._onLoadingHandled =
            obj._onLoadedHandled =
            obj._onInteractiveHandled =
            obj._onCompleteHandled = false;
    };

    obj._onLoading = function() {

        if (obj._onLoadingHandled)
            return;
        if (!obj._retry && obj.group != null) {
            if (typeof advAJAX._groupData[obj.group] == "undefined")
                advAJAX._groupData[obj.group] = 0;
            advAJAX._groupData[obj.group]++;
            if (typeof obj.onGroupEnter == "function" && advAJAX._groupData[obj.group] == 1)
                obj.onGroupEnter(obj);
        }
        obj.raiseEvent("Loading", obj);
        obj._onLoadingHandled = true;
    };
    obj._onLoaded = function() {

        if (obj._onLoadedHandled)
            return;
        obj.raiseEvent("Loaded", obj);
        obj._onLoadedHandled = true;
    };
    obj._onInteractive = function() {

        if (obj._onInteractiveHandled)
            return;
        obj.raiseEvent("Interactive", obj);
        obj._onInteractiveHandled = true;
        if (!obj._progressStarted)
            obj._onProgress();
    };
    obj._onComplete = function() {

        if (obj._onCompleteHandled || obj.aborted)
            return;
        if (obj._progressStarted) {
            window.clearInterval(obj._progressTimer);
            obj._progressStarted = false;
        }
        obj.requestDone = true;
        with (obj.xmlHttpRequest) {
            obj.responseText = responseText;
            obj.responseXML = responseXML;
            if (typeof status != "undefined")
                obj.status = status;
            if (typeof statusText != "undefined")
                obj.statusText = statusText;
        }
        obj.raiseEvent("Complete", obj);
        obj._onCompleteHandled = true;
        if (obj.status == 200)
            obj.raiseEvent("Success", obj); else
            obj.raiseEvent("Error", obj);
        delete obj.xmlHttpRequest['onreadystatechange'];
        obj.xmlHttpRequest = null;
        if (obj.disableForm)
            obj.switchForm(true);
        obj._groupLeave();
        obj.raiseEvent("Finalization", obj);
    };

    obj._groupLeave = function() {

        if (obj.group != null) {
            advAJAX._groupData[obj.group]--;
            if (advAJAX._groupData[obj.group] == 0)
                obj.raiseEvent("GroupLeave", obj);
        }
    };

    obj._retry = false;
    obj._retryNo = 0;
    obj._onTimeout = function() {

        if (obj == null || obj.xmlHttpRequest == null || obj._onCompleteHandled)
            return;
        obj.aborted = true;
        obj.xmlHttpRequest.abort();
        obj.raiseEvent("Timeout", obj);
        obj._retry = true;
        if (obj._retryNo != obj.retryCount) {
            obj._initObject();
            if (obj.retryDelay > 0) {
                obj.raiseEvent("RetryDelay", obj);
                startTime = new Date().getTime();
                while (new Date().getTime() - startTime < obj.retryDelay);
            }
            obj._retryNo++;
            obj.raiseEvent("Retry", obj, obj._retryNo);
            obj.run();
        } else {
            delete obj.xmlHttpRequest["onreadystatechange"];
            obj.xmlHttpRequest = null;
            if (obj.disableForm)
                obj.switchForm(true);
            obj._groupLeave();
            obj.raiseEvent("Finalization", obj);
        }
    };

    obj.run = function() {

        obj._initObject();
        if (obj.xmlHttpRequest == null)
            return false;
        obj.aborted = false;
        if (!obj._onInitializationHandled) {
            obj.raiseEvent("Initialization", obj);
            obj._onInitializationHandled = true;
        }
        if (obj.method == "GET" && obj.unique)
            obj.parameters[encodeURIComponent(obj.uniqueParameter)] =
            new Date().getTime().toString().substr(5) + Math.floor(Math.random() * 100).toString();
        if (!obj._retry) {
            for (var a in obj.parameters) {
                if (obj.queryString.length > 0)
                    obj.queryString += "&";
                if (typeof obj.parameters[a] != "object")
                    obj.queryString += encodeURIComponent(a) + "=" + encodeURIComponent(obj.parameters[a]); else {
                    for (var i = 0; i < obj.parameters[a].length; i++)
                        obj.queryString += encodeURIComponent(a) + "=" + encodeURIComponent(obj.parameters[a][i]) + "&";
                    obj.queryString = obj.queryString.slice(0, -1);
                }
            }
            for (var a in obj.jsonParameters) {
                var useJson = typeof [].toJSONString == 'function';
                if (obj.queryString.length > 0)
                    obj.queryString += "&";
                obj.queryString += encodeURIComponent(a) + "=";
                if (useJson)
                    obj.queryString += encodeURIComponent(obj.jsonParameters[a].toJSONString()); else
                    obj.queryString += encodeURIComponent(obj.jsonParameters[a]);
            }
            if (obj.method == "GET" && obj.queryString.length > 0)
                obj.url += (obj.url.indexOf("?") != -1 ? "&" : "?") + obj.queryString;
        }
        if (obj.disableForm)
            obj.switchForm(false);
        try {
            obj.xmlHttpRequest.open(obj.method, obj.url, obj.async, obj.username || '', obj.password || '');
        } catch (e) {
            obj.raiseEvent("FatalError", obj, e);
            return;
        }
        if (obj.timeout > 0)
            setTimeout(obj._onTimeout, obj.timeout);
        if (typeof obj.xmlHttpRequest.setRequestHeader != "undefined")
            for (var a in obj.headers)
                obj.xmlHttpRequest.setRequestHeader(encodeURIComponent(a), encodeURIComponent(obj.headers[a]));
        if (obj.method == "POST" && typeof obj.xmlHttpRequest.setRequestHeader != "undefined") {
            obj.xmlHttpRequest.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            obj.xmlHttpRequest.send(obj.queryString);
        } else if (obj.method == "GET")
            obj.xmlHttpRequest.send('');
    };

    obj.handleArguments = function(args) {

        if (typeof args.form == "object" && args.form != null) {
            obj.form = args.form;
            obj.appendForm();
        }
        for (a in args) {
            if (typeof obj[a] == "undefined")
                obj.parameters[a] = args[a]; else {
                if (a != "parameters" && a != "headers")
                    obj[a] = args[a]; else
                    for (b in args[a])
                        obj[a][b] = args[a][b];
            }
        }
        obj.method = obj.method.toUpperCase();
    };

    obj.switchForm = function(enable) {

        if (typeof obj.form != "object" || obj.form == null)
            return;
        with (obj.form)
            for (var nr = 0; nr < elements.length; nr++)
                if (!enable) {
                    if (elements[nr]["disabled"])
                        elements[nr]["_disabled"] = true; else
                        elements[nr]["disabled"] = "disabled";
                } else
                    if (typeof elements[nr]["_disabled"] == "undefined")
                        elements[nr].removeAttribute("disabled");
    };

    obj.appendForm = function() {

        with (obj.form) {
            obj.method = getAttribute("method").toUpperCase();
            obj.url = getAttribute("action");
            for (var nr = 0; nr < elements.length; nr++) {
                var e = elements[nr];
                if (e.disabled)
                    continue;
                switch (e.type) {
                    case "text":
                    case "password":
                    case "hidden":
                    case "textarea":
                        obj.addParameter(e.name, e.value);
                        break;
                    case "select-one":
                        if (e.selectedIndex >= 0)
                            obj.addParameter(e.name, e.options[e.selectedIndex].value);
                        break;
                    case "select-multiple":
                        for (var nr2 = 0; nr2 < e.options.length; nr2++)
                            if (e.options[nr2].selected)
                                obj.addParameter(e.name, e.options[nr2].value);
                        break;
                    case "checkbox":
                    case "radio":
                        if (e.checked)
                            obj.addParameter(e.name, e.value);
                        break;
                }
            }
        }
    };

    obj.addParameter = function(name, value) {
        if (typeof obj.parameters[name] == "undefined")
            obj.parameters[name] = value; else
        if (typeof obj.parameters[name] != "object")
            obj.parameters[name] = [ obj.parameters[name], value ]; else
        obj.parameters[name][obj.parameters[name].length] = value;
    };
    obj.delParameter = function(name) {

        delete obj.parameters[name];
    };
    obj.raiseEvent = function(name) {
        var args = [];
        for (var i = 1; i < arguments.length; i++)
            args.push(arguments[i]);
        if (typeof obj["on" + name] == "function")
            obj["on" + name].apply(null, args);
        if (name == "FatalError")
            obj.raiseEvent("Finalization", obj);
    }

    if (typeof advAJAX._defaultParameters != "undefined")
        obj.handleArguments(advAJAX._defaultParameters);
    return obj;
}

advAJAX.get = function(args) {

    return advAJAX.handleRequest("GET", args);
};

advAJAX.post = function(args) {

    return advAJAX.handleRequest("POST", args);
};

advAJAX.head = function(args) {

    return advAJAX.handleRequest("HEAD", args);
};

advAJAX.submit = function(form, args) {

    if (typeof args == "undefined" || args == null)
        return -1;
    if (typeof form != "object" || form == null)
        return -2;
    var request = new advAJAX();
    args["form"] = form;
    request.handleArguments(args);
    return request.run();
};

advAJAX.assign = function(form, args) {

    if (typeof args == "undefined" || args == null)
        return -1;
    if (typeof form != "object" || form == null)
        return -2;
    if (typeof form["onsubmit"] == "function")
        form["_onsubmit"] = form["onsubmit"];
    form["advajax_args"] = args;
    form["onsubmit"] = function() {
        if (typeof this["_onsubmit"] != "undefined" && this["_onsubmit"]() === false)
            return false;
        if (advAJAX.submit(this, this["advajax_args"]) == false)
            return true;
        return false;
    }
    return true;
};

advAJAX.download = function(targetObj, url) {

    if (typeof targetObj == "string")
        targetObj = document.getElementById(targetObj);
    if (!targetObj)
        return -1;
    advAJAX.get({
        url: url,
        onSuccess : function(obj) {
            targetObj.innerHTML = obj.responseText;
        }
    });
};

advAJAX.scan = function() {

    var obj = document.getElementsByTagName("a");
    for (var i = 0; i < obj.length;) {
        if (obj[i].getAttribute("rel") == "advancedajax" && obj[i].getAttribute("href") !== null) {
            var url = obj[i].getAttribute("href");
            var div = document.createElement("div");
            div.innerHTML = obj[i].innerHTML;
            div.className = obj[i].className;
            var parent = obj[i].parentNode;
            parent.insertBefore(div, obj[i]);
            parent.removeChild(obj[i]);
            advAJAX.download(div, url);
        } else i++;
    }
};

advAJAX.handleRequest = function(requestType, args) {

    if (typeof args == "undefined" || args == null)
        return -1;
    var request = new advAJAX();
    window.advajax_obj = request;
    request.method = requestType;
    request.handleArguments(args);
    return request.run();
};

advAJAX._defaultParameters = new Object();
advAJAX.setDefaultParameters = function(args) {

    advAJAX._defaultParameters = new Object();
    for (a in args)
        advAJAX._defaultParameters[a] = args[a];
};

advAJAX._groupData = new Object();