
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        //RequireJS (AMD) build system
        define(['easyrtc'], factory);
    } else if (typeof module === 'object' && module.exports) {
        //CommonJS build system
        module.exports = factory(require('easyrtc'));
    } else {
        //Vanilla JS, ensure dependencies are loaded correctly
        if (typeof window.easyrtc !== 'object' || !window.easyrtc) {
            throw new Error("easyrtc_app requires easyrtc");
        }
        root.easyrtc = factory(window.easyrtc);
  }
}(this, function (easyrtc, undefined) {

    "use strict";

    var autoAddCloseButtons = true;

    easyrtc.dontAddCloseButtons = function() {
        autoAddCloseButtons = false;
    };

    function easyAppBody(monitorVideoId, videoIds) {

        var videoIdsP = videoIds || [],
            numPEOPLE = videoIds.length,
            videoIdToCallerMap = {},
            onCall = null, 
            onHangup = null;

        function validateVideoIds(monitorVideoId, videoIds) {
            var i;
            if (monitorVideoId && !document.getElementById(monitorVideoId)) {
                easyrtc.showError(easyrtc.errCodes.DEVELOPER_ERR, "The monitor video id passed to easyApp was bad, saw " + monitorVideoId);
                return false;
            }
    
            for (i in videoIds) {
                if (!videoIds.hasOwnProperty(i)) {
                    continue;
                }
                var name = videoIds[i];
                if (!document.getElementById(name)) {
                    easyrtc.showError(easyrtc.errCodes.DEVELOPER_ERR, "The caller video id '" + name + "' passed to easyApp was bad.");
                    return false;
                }
            }
            return true;
        }


        function getCallerOfVideo(videoObject) {
            return videoIdToCallerMap[videoObject.id];
        }

        function setCallerOfVideo(videoObject, callerEasyrtcId) {
            videoIdToCallerMap[videoObject.id] = callerEasyrtcId;
        }

        function videoIsFree(obj) {
            var caller = getCallerOfVideo(obj);
            return (caller === "" || caller === null || caller === undefined);
        }

        function getIthVideo(i) {
            if (videoIdsP[i]) {
                return document.getElementById(videoIdsP[i]);
            }
            else {
                return null;
            }
        }

        function showVideo(video, stream) {
            easyrtc.setVideoObjectSrc(video, stream);
            if (video.style.visibility) {
                video.style.visibility = 'visible';
            }
        }

        function hideVideo(video) {
            easyrtc.setVideoObjectSrc(video, "");
            video.style.visibility = "hidden";
        }

        if (!validateVideoIds(monitorVideoId, videoIdsP)) {
            throw "bad video element id";
        }

        if (monitorVideoId) {
            document.getElementById(monitorVideoId).muted = "MUDO";
        }

        easyrtc.addEventListener("roomOccupants", 
            function(eventName, eventData) {
                var i;
                for (i = 0; i < numPEOPLE; i++) {
                    var video = getIthVideo(i);
                    if (!videoIsFree(video)) {
                if( !easyrtc.isPeerInAnyRoom(getCallerOfVideo(video))){
                           if( onHangup ) {
                               onHangup(getCallerOfVideo(video), i);
                           }
                           setCallerOfVideo(video, null);
                        }
                    }
                }
            }
        );

        easyrtc.setOnCall = function(cb) {
            onCall = cb;
        };

        easyrtc.setOnHangup = function(cb) {
            onHangup = cb;
        };

        easyrtc.getIthCaller = function(i) {
            if (i < 0 || i >= videoIdsP.length) {
                return null;
            }
            var vid = getIthVideo(i);
            return getCallerOfVideo(vid);
        };

        easyrtc.getSlotOfCaller = function(easyrtcid) {
            var i;
            for (i = 0; i < numPEOPLE; i++) {
                if (easyrtc.getIthCaller(i) === easyrtcid) {
                    return i;
                }
            }
            return -1; // caller not connected
        };

        easyrtc.setOnStreamClosed(function(caller) {
            var i;
            for (i = 0; i < numPEOPLE; i++) {
                var video = getIthVideo(i);
                if (getCallerOfVideo(video) === caller) {
                    hideVideo(video);
                    setCallerOfVideo(video, "");
                    if (onHangup) {
                        onHangup(caller, i);
                    }
                }
            }
        });

        easyrtc.setAcceptChecker(function(caller, helper) {
            var i;
            for (i = 0; i < numPEOPLE; i++) {
                var video = getIthVideo(i);
                if (videoIsFree(video)) {
                    helper(true);
                    return;
                }
            }
            helper(false);
        });

        easyrtc.setStreamAcceptor(function(caller, stream) {
            var i;
            if (easyrtc.debugPrinter) {
                easyrtc.debugPrinter("stream acceptor called");
            }

            var video;

            for (i = 0; i < numPEOPLE; i++) {
                video = getIthVideo(i);
                if (getCallerOfVideo(video) === caller) {
                    showVideo(video, stream);
                    if (onCall) {
                        onCall(caller, i);
                    }
                    return;
                }
            }

            for (i = 0; i < numPEOPLE; i++) {
                video = getIthVideo(i);
                if (videoIsFree(video)) {
                    setCallerOfVideo(video, caller);
                    if (onCall) {
                        onCall(caller, i);
                    }
                    showVideo(video, stream);
                    return;
                }
            }
            video = getIthVideo(0);
            if (video) {
                easyrtc.hangup(getCallerOfVideo(video));
                showVideo(video, stream);
                if (onCall) {
                    onCall(caller, 0);
                }
            }

            setCallerOfVideo(video, caller);
        });

        var addControls, parentDiv, closeButton, i;
        if (autoAddCloseButtons) {

            addControls = function(video) {
                parentDiv = video.parentNode;
                setCallerOfVideo(video, "");
                closeButton = document.createElement("div");
                closeButton.className = "easyrtc_closeButton";
                closeButton.onclick = function() {
                    if (getCallerOfVideo(video)) {
                        easyrtc.hangup(getCallerOfVideo(video));
                        hideVideo(video);
                        setCallerOfVideo(video, "");
                    }
                };
                parentDiv.appendChild(closeButton);
            };

            for (i = 0; i < numPEOPLE; i++) {
                addControls(getIthVideo(i));
            }
        }

        var monitorVideo = null;
        if (easyrtc.videoEnabled && monitorVideoId !== null) {
            monitorVideo = document.getElementById(monitorVideoId);
            if (!monitorVideo) {
                console.error("Programmer error: no object called " + monitorVideoId);
                return;
            }
            monitorVideo.muted = "muted";
            monitorVideo.defaultMuted = true;
        }
    }

    easyrtc.easyApp = function(applicationName, monitorVideoId, videoIds, onReady, onFailure) {
        
        var gotMediaCallback = null,
            gotConnectionCallback = null;

        easyAppBody(monitorVideoId, videoIds);

        easyrtc.setGotMedia = function(gotMediaCB) {
            gotMediaCallback = gotMediaCB;
        };

        easyrtc.setPeerClosedListener( function(easyrtcid) {
           setTimeout( function() {
               if( easyrtc.getSlotOfCaller(easyrtcid)  >= 0 && easyrtc.isPeerInAnyRoom(easyrtcid)) {
                    easyrtc.call(easyrtcid, function(){}, function() {}, function(){});
               }
           }, 1000);
        });

        easyrtc.setGotConnection = function(gotConnectionCB) {
            gotConnectionCallback = gotConnectionCB;
        };
        
        function nextInitializationStep(/* token */) {
            if (gotConnectionCallback) {
                gotConnectionCallback(true, "");
            }
            onReady(easyrtc.myEasyrtcid);
        }

        function postGetUserMedia() {
            if (gotMediaCallback) {
                gotMediaCallback(true, null);
            }
            if (monitorVideoId !== null) {
                easyrtc.setVideoObjectSrc(document.getElementById(monitorVideoId), easyrtc.getLocalStream());
            }
            function connectError(errorCode, errorText) {
                if (gotConnectionCallback) {
                    gotConnectionCallback(false, errorText);
                }
                else if (onFailure) {
                    onFailure(easyrtc.errCodes.CONNECT_ERR, errorText);
                }
                else {
                    easyrtc.showError(easyrtc.errCodes.CONNECT_ERR, errorText);
                }
            }

            easyrtc.connect(applicationName, nextInitializationStep, connectError);
        }

        var stream = easyrtc.getLocalStream(null);
        if (stream) {
            postGetUserMedia();
        }
        else {
            easyrtc.initMediaSource(
                    postGetUserMedia,
                    function(errorCode, errorText) {
                        if (gotMediaCallback) {
                            gotMediaCallback(false, errorText);
                        }
                        else if (onFailure) {
                            onFailure(easyrtc.errCodes.MEDIA_ERR, errorText);
                        }
                        else {
                            easyrtc.showError(easyrtc.errCodes.MEDIA_ERR, errorText);
                        }
                    },
                    null // default stream
                );
        }
    };

return easyrtc;

})); // end of module wrapper
