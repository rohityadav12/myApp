WebrtcObj = null;
function Webrtc() {
    var debug = Debug(true);
    var self = this;
    var iceServers = [];
    iceServers.push(getSTUNObj('stun:stun.l.google.com:19302'));
    iceServers.push(getTURNObj('turn:webrtcweb.com:7788', 'muazkh', 'muazkh'));
    iceServers.push(getTURNObj('turn:webrtcweb.com:8877', 'muazkh', 'muazkh'));
    iceServers.push(getTURNObj('turns:webrtcweb.com:7788', 'muazkh', 'muazkh'));

    var iceConfig = { 'iceServers': iceServers},
        currentSocketId,
        isJoin=false,
        firststreamid = '',
        _browser = detectBrowser();
    
    this.DataChannel = true;
    this.peers = {};
    this.roomid = "webrtc";
    this.socketUrl = "https://talkroom-io.herokuapp.com/";
    this.audioBandwidth = 240;
    this.videoBandwidth = 480;
    this.constraints = {
                            audio: true,
                            video: {
                                mandatory: {
                                    maxWidth: 640
                                },
                                optional: [
                                               {maxFrameRate: 15}, 
                                               {minFrameRate: 15}
                                        ]
                                }
                        };
    this.localstreams = {};
    this.remotestreams = {};

    //default server syn values
    this.data = {};
    this.data.userid =  (Date.now()).toString();
    this.data._browser = _browser;
    this.data.extra = {};
    this.data.firststreamid = firststreamid;
    this.data.streams = [];
    this.pluginUrl = '',this.isPlugin = false;;
    
    //remote users
    this.remoteusers = {};

    this.socket = null;

    connectSocket = (callback) => {
        var callback = callback || function(){};
        if(self.socket) {
            callback(self.socket);
            return;
        }

        var param = self.data;

        param = JSON.stringify(param);
        self.socket = io.connect(this.socketUrl, { query: "param="+param });

        self.socket.on('connect', () => {
            debug.log("connected", self.socket.id);
            currentSocketId = self.socket.id;
            callback(self.socket);
            return false;
        });

        self.socket.on('connect_error', (e) =>{
            debug.error('connect_error',e);
            callback(null, e);
        });

        self.socket.on('peer.connected', (params) => {

            self.remoteusers[params.id] = params.data;
            self.peers[params.id] = self.peers[params.id] || {};
            self.peers[params.id].isOfferer = true;
            self.data.streams.forEach( streamid => {
                self.peerAddStream(self.localstreams[streamid], params.id);
                makeOffer(streamid, params.id);
            });
            
        });

        self.socket.on('stream.connected', (params) => {

            self.remoteusers[params.id] = params.data;
            get_PC(params.id,params.streamid);
            
        });
        self.socket.on('peer.disconnected', (params)=> {
            debug.log("peer.disconnected",params.id);
            delete self.remoteusers[params.id];
            delete self.remotestreams[param.id];
            delete self.peers[param.id];
            self.ondisconnect(params);
        });
        self.socket.on('signalling', (data)=> {
            handleMessage(data);
        });
        self.socket.on('switching', (records)=> {
            self.remoteusers[records.id] = records.data;
            handleSwitching(records);
        });
        self.socket.on('updatedata', (params)=> {
            self.remoteusers[params.id] = params.data;
            self.onupdatedata(params.data);
        });
    };
    //connectSocket start    
    self.connectSocket = (callback)=> {
        connectSocket(callback);
    }
    //connectSocket end

    this.closeRoom = () =>{
        console.log('closeRoom');
        this.socket.close();

        for (var key in self.localstreams) {
            if(this.localstreams.hasOwnProperty(key)){
                this.localstreams[key].getTracks().forEach((track)=> {
                        this.localstreams[key].removeTrack(track);
                        if(track.stop) { track.stop(); }
                    });
            }
        };
        
        for (let socketId in self.remoteusers) {
            if(self.remoteusers.hasOwnProperty(socketId)){
                self.remoteusers[socketId].streams.forEach(streamid=>{
                    var pc = get_PC(socketId, streamid);
                    pc.close();
                })
            }
        }
        
    }

    this.onupdatedata = params => { debug.warn('unused onupdatedata', params); }
    this.updatedata = () => {
        debug.info('update data');
        this.socket.emit( "updatedata", self.data);
    }

    this.getRemoteUsers = (id)=> {
        if(id) {
            return self.remoteusers[id] || null ;
        }else{
            return self.remoteusers;
        }
    }
    
    //navigator.getUserMedia start
    getMedia = (constraints , callback) => {
        navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => { callback(null,stream) })
        .catch((e)=>{ callback(e,null); });
    }



    this.joinroom = (callback)=> {

        if(isJoin) {
            callback('already Join Offered', null);
            return false;
        }
        connectSocket((socket)=>{
            getMedia(self.constraints, (error, stream)=>{
                if(error){ callback(error, null); return }
                isJoin = true;
                stream.type = 'local';
                self.data.firststreamid = firststreamid = stream.id;
                self.data.streams.push(firststreamid);
                self.localstreams[firststreamid] = stream;
                self.socket.emit( "join", self.roomid, self.data , (rooms)=> {
                    delete rooms[currentSocketId];
                    for( let socketId in rooms ) {
                        self.peers[socketId] = self.peers[socketId] || {};
                        self.peers[socketId].isOfferer = false;
                    }
                    self.remoteusers = rooms;
                    self.peerAddStream(self.localstreams[firststreamid]);
                    
                });
                self.getDevices(self.ondevice);

                self.onlocalstream({ id:currentSocketId, stream: stream, data: self.data });
            });
        })
        
    };
    this.getConstraints = (constraints)=> {
        if(constraints === 'screen') {
            debug.warn("screen plugin not install.");
            return false;
        }else if(typeof constraints === 'object') {
            if(constraints.audioId !== undefined || constraints.videoId !== undefined){
                return constraints = {
                    audio: {deviceId: constraints.audioId ? {exact: constraints.audioId} : undefined},
                    video: {deviceId: constraints.videoId ? {exact: constraints.videoId} : undefined}
                };
            }
        }else {
            
            return constraints = {
                    audio: true,
                          
                    video: {
                        mandatory: {
                            maxWidth: 640
                        },
                        optional: [
                                   {maxFrameRate: 15}, 
                                   {minFrameRate: 15}
                                   ]
                    }
                    
                };
        }
    }
    switchStream = (oldstream, newstream) => {
        oldstream.getTracks().forEach((track)=> {
            oldstream.removeTrack(track);
            if(track.stop) { track.stop(); }
        });
        newstream.getTracks().forEach(track =>{ oldstream.addTrack(track); });
        if (_browser.firefox) {
            for (let socketId in self.remoteusers) {
                if(self.remoteusers.hasOwnProperty(socketId)){

                    var pc = get_PC(socketId, oldstream.id);

                    Promise.all(pc.getSenders().map(sender =>
                    sender.replaceTrack((sender.track.kind == "audio")?
                                        newstream.getAudioTracks()[0] :
                                        newstream.getVideoTracks()[0])))
                    .then(() => debug.log("switched!"))
                    .catch((e)=>{debug.error('replacetrack: ',e)});
                }
            }
            makeOffer(oldstream.id);
        }else {
            self.peerRemoveStream(oldstream);
            makeOffer(oldstream.id);
            setTimeout(()=>{
                self.peerAddStream(oldstream);
                makeOffer(oldstream.id);
            } , 1000)
        }
    }
    this.switchStream = (oldstreamid,constraints, callback) => {
        debug.info('switch stream start');
        if(oldstreamid != firststreamid){
            var error = "only main stream can be switched ";
            callback(error);
            return;
        }
        var records = { id:currentSocketId,streamid: oldstreamid, data:self.data ,status:'start'};
        self.socket.emit('switching', records);
        try {
            if(self.isStream(oldstreamid) && self.canAddStream()) {
                getMedia(constraints, (error, newstream) => {
                    if(error){
                        records.status = "fail";
                        self.socket.emit('switching', records);
                        callback(error);
                        return;
                    }
                    switchStream(self.localstreams[firststreamid], newstream);
                    reloadVideoTag(self.localstreams[firststreamid]);
                    records.status = "success";
                    self.socket.emit('switching', records);
                    callback(null,self.localstreams[firststreamid]);
                });
            }
        }catch (e) {
            records.status = "fail";
            self.socket.emit('switching', records);
            callback(e);
        }
    }

    //navigator.getUserMedia end
    this.isStream = (streamid) => {
        if(self.localstreams[streamid] === undefined) {
            debug.error("no local stream found with this streamid: "+streamid);
            return false;
        }else {
            return true;
        }
    }    
    this.canAddStream = () => {
        if(!Object.size(self.remoteusers)){
            debug.error("cannot add stream because no remote users found");
            return false;
        }else{
            return true;
        }
    }
    this.canRemoveStream = (streamid) => {

        if(firststreamid === streamid) {
            debug.error("cannot remove first stream: "+streamid);
            return false
        }else{
            return true;
        }
    }
    
    this.peerAddStream = (stream, socketId ) => {
        var add = (socketId, streamid) => {
            var pc = get_PC(socketId, streamid);
            pc.addStream(stream);
        }
        if(socketId){
            add(socketId, stream.id);
        } else{
            for (let socketId in this.remoteusers) {
                if(this.remoteusers.hasOwnProperty(socketId)){
                    add(socketId, stream.id);
                }
            }
        }
    }
    this.peerRemoveStream = (stream, socketId) => {
        var streamid = stream.id;
        var remove = (socketId, streamid) =>{
            var pc = get_PC(socketId,streamid);
            if (_browser.firefox) {
                pc.getSenders().forEach( (sender)=> {
                    stream.getTracks().forEach((track)=> {
                        if (sender.track === track) {
                            pc.removeTrack(sender);
                        }
                    });
                });
            } else {
                pc.removeStream(stream);
            }
            if(streamid !== firststreamid) {
                setTimeout( ()=> { delete self.peers[socketId][streamid]; }, 2000);
            }
        };
        
        if(socketId) {
            remove(socketId, stream.id);
        }else{
            for (let socketId in this.remoteusers) {
                if(this.remoteusers.hasOwnProperty(socketId)){
                    remove(socketId, stream.id);
                }
            }
        }
    }
    this.setBandwidth = setBandwidth = sdp => {
        var temp = sdp.sdp;
        temp = temp.replace(/a=mid:audio\r\n/gi, 'a=mid:audio\r\nb=AS:'+self.audioBandwidth+'\r\n');
        temp = temp.replace(/a=mid:video\r\n/gi, 'a=mid:video\r\nb=AS:'+self.videoBandwidth+'\r\n');
        sdp.sdp = temp;
        debug.info('sdp', temp);
        return sdp;
    }
    this.muteUnmute = streamid => {
        if(self.isStream(streamid)) {
            var audioTracks = self.localstreams[streamid].getAudioTracks();
            if(audioTracks.length === 0 ) {
                debug.error("no audio tracks found.")
                return false;
            }
            var audio = audioTracks[0];
            audio.enabled = !audio.enabled;
            return audio.enabled;
        }
    }
    this.playPause = streamid => {
        if(self.isStream(streamid)) {
            var videoTracks = self.localstreams[streamid].getVideoTracks();
            if(videoTracks.length === 0 ) {
                debug.error("no video tracks found.")
                return false;
            }
            var video = videoTracks[0];
            video.enabled = !video.enabled;
            return video.enabled;
        }
    }
    self.onLocalStreamended = (data)=> {
        debug.warn("unused onLocalStreamended");
    }
    self.onRemoteStreamended = (data)=> {
        debug.warn("unused onRemoteStreamended");
    }
    self.removeStream = (streamid) => {
        if(self.isStream(streamid) && this.canRemoveStream(streamid)) {
            removeStream(streamid);
        }
    }
    removeStream = streamid => {
        var stream = self.localstreams[streamid];
        delete self.localstreams[streamid];
        this.peerRemoveStream(stream);
        var index = self.data.streams.indexOf(streamid);
        self.data.streams.splice(index,1);
        stream.getTracks().forEach(track => {track.stop(); stream.removeTrack(track);});
        self.onLocalStreamended({ id: currentSocketId, streamid: stream.id ,type:'local', data: self.data});
        makeOffer(streamid);
    }


    self.onremotestream =  (event)=> {
        debug.warn("unused onremotestream");
    }
    self.onlocalstream =  (event)=> {
        debug.warn("unused onlocalstream");
    }
    self.ondisconnect = (data)=>{
        debug.warn("unused ondisconnect");
    }

    this.sendTextMessage = msg => {
        var obj = {};
        obj.data = this.data;
        obj.type = 'text';
        obj.message = msg;
        for(let socketId in this.remoteusers){
            if(this.remoteusers.hasOwnProperty(socketId)){
                self.peers[socketId].channel.send(JSON.stringify(obj));
            }
        }
    }

    get_PC = (socketId,streamid)=> {
        var streamid = streamid === firststreamid ? 'firststreamid': streamid;
        self.peers[socketId][streamid] = self.peers[socketId][streamid] || {};
        if (self.peers[socketId][streamid].pc ) {
            return self.peers[socketId][streamid].pc;
        }
        var pc = new RTCPeerConnection(iceConfig);
        self.peers[socketId].renegotiated = false;
        
        self.peers[socketId][streamid].pc = pc;

        if(self.DataChannel && streamid === 'firststreamid') {
            setChannelEvents = (channel) => {
                // force ArrayBuffer in Firefox; which uses "Blob" by default.
                channel.binaryType = 'arraybuffer';

                channel.onmessage = (event)=> {
                    let obj = JSON.parse(event.data);
                    if(obj.type === 'text')
                        self.onmessage(obj);
                };

                channel.onopen = (event)=> {
                    debug.info('channel is opened');
                };

                channel.onerror = (error)=> {
                    debug.error(error);
                };

                channel.onclose = (event)=> {
                    debug.log('channel is closeed');
                };

                channel.internalSend = channel.send;
                channel.send = (data)=> {
                    if (channel.readyState !== 'open') {
                        return;
                    }
                    channel.internalSend(data);
                };
            }

            if (!self.peers[socketId].isOfferer) {
                pc.ondatachannel = (event)=> {
                    var channel = event.channel;
                    setChannelEvents(channel);
                    self.peers[socketId].channel = channel
                };
            } else {
                var channel = pc.createDataChannel('sctp', {});
                setChannelEvents(channel);
                self.peers[socketId].channel = channel
            }
        }

        pc.onicecandidate = (evnt)=> {
            debug.log('sending ice candidate');
            self.socket.emit('signalling', { by: currentSocketId, to: socketId, streamid: streamid, ice: evnt.candidate, type: 'ice' });
        };
        pc.onaddstream = (event)=> {
            debug.log('Received new stream');
            event.stream.type = 'remote';
            var data = { id:socketId, stream: event.stream, data: self.remoteusers[socketId]};
            self.remotestreams[socketId] = self.remotestreams[socketId] || {};
            self.remotestreams[socketId].streams = self.remotestreams[socketId].streams || {};
            self.remotestreams[socketId].streams[event.stream.id] = event.stream;
            self.onremotestream(data);
        };


        //switch start
        pc.onnegotiationneeded = ()=> {
            //debug.log("onnegotiationneeded",streamid);

            //stop to run it on starting add video in chrome
            // if( !self.peers[socketId].renegotiated && streamid === 'firststreamid') {
            //     self.peers[socketId].renegotiated = true;
            //     return;
            // }

            self.peers[socketId].renegotiated = true;
            
            //makeOffer(streamid, socketId);
        };
        pc.onremovestream = (event)=> {
            debug.info('remote stream removed');
            delete self.remotestreams[socketId].streams[event.stream.id];
            if(streamid !== 'firststreamid') {
                setTimeout(() => {
                    self.peers[socketId][streamid].pc.close();
                    delete self.peers[socketId][streamid];
                }, 1000);
            }
            self.onRemoteStreamended({ id: socketId, streamid: event.stream.id, type:'remote', data: self.remoteusers[socketId]});
        };
        pc.oniceconnectionstatechange = ()=> {
            debug.log('iceConnectionState: ', pc.iceConnectionState);
            if(pc.iceConnectionState == 'connected') {
            }
        }
        //switch end
        
        return pc;
    }

    makeOffer = (streamid, socketId)=> {
        if(!streamid) {
            debug.error('invalid offer');
            return;
        }

        var offer = (streamid, socketId) => {
            if(streamid === firststreamid){  streamid = 'firststreamid'; }
            var pc = get_PC(socketId, streamid);
            pc.createOffer((sdp)=> {
                pc.setLocalDescription(sdp);
                debug.log('Creating an offer for socketId:', socketId, 'streamid', streamid);
                self.socket.emit('signalling', { by: currentSocketId, to: socketId, streamid: streamid, sdp: setBandwidth(sdp), type: 'sdp-offer' });
                
            },(e)=>{ debug.error('pc.createOffer error',e); }
            //,{ mandatory: { offerToReceiveVideo: true, offerToReceiveAudio: true }}
            );
        }
        if(socketId) {
            offer(streamid, socketId);
        }else {
            for(let socketId in self.remoteusers) {
                if(self.remoteusers.hasOwnProperty(socketId)){
                    offer(streamid, socketId);
                }
            }
        }
    }

    handleMessage = (data)=> {
        var pc = get_PC(data.by,data.streamid);
        switch (data.type) {
            case 'sdp-offer':
                pc.setRemoteDescription(new RTCSessionDescription(data.sdp), ()=> {
                    debug.log('Setting remote description by offer');
                    pc.createAnswer((sdp)=> {
                        pc.setLocalDescription(sdp);
                        self.socket.emit('signalling', { by: currentSocketId, to: data.by, streamid: data.streamid, sdp: setBandwidth(sdp), type: 'sdp-answer' });
                    }, (e)=>{ debug.error('createOffer error: ',e); });
                }, (e)=>{ debug.error('remoteDescription error: ',e); });
                break;
        case 'sdp-answer':
            pc.setRemoteDescription(new RTCSessionDescription(data.sdp), ()=> {
                debug.log('Setting remote description by answer');
            }, (e)=>{ debug.error('remoteDescription error: ',e); });
            break;
        case 'ice':
            if (data.ice) {
                debug.log('Adding ice candidates');
                pc.addIceCandidate(new RTCIceCandidate(data.ice));
            }
            break;
        }
    }
    handleSwitching = (records)=> {
        switch (records.status) {
            case 'start':
                break;
            case 'success':
                setTimeout(() => { reloadVideoTag(self.remotestreams[records.id].streams[records.streamid]); }, 1000);
                break;
            case 'fail':
                debug.error(JSON.stringify({socketId:records.id,streamid:records.streamid,switching:'fail'}) );
                break;
        }
    }
    reloadVideoTag = stream => {
        if(!stream) { debug.warn('stream not exists to reload'); return false; }
        try {
            document.getElementById(stream.id).srcObject = stream;
        }catch(e){
            debug.error('no video element id match with streamid:', stream.id);
        }
    }

    self.ondevice = (devices)=> {
        debug.warn("unused ondevice");
    }
    self.onmessage = (data) => {
        debug.warn('unused onmessage');
    }
    self.getDevices = (callback)=> {
        debug.log('get devices');
        var dv = { audioIp:{}, videoIp: {} };
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            debug.warn("enumerateDevices() not supported.");
            return false;
        }

        // List cameras and microphones.
        navigator.mediaDevices.enumerateDevices()
        .then( (devices)=> {
            devices.forEach( (device)=> {
                if( device.kind == 'default' || device.label == 'Default' || device.deviceId == 'default') {
                    return false;
                }
                if(device.label != 'Default' && device.deviceId != 'default') {

                    if( device.kind == 'audioinput') {
                        dv.audioIp[device.deviceId] = { label: device.label, value: device.deviceId };
                    }
                    if( device.kind == 'videoinput') {
                        dv.videoIp[device.deviceId] = { label: device.label, value: device.deviceId };
                    }
                }
            });
            callback(dv);
        })
        .catch( (err)=> {
          debug.log(err.name + ": " + err.message);
        });
    }

    //screen share plugin code
    if (_browser.chrome) {
        self.pluginUrl = "https://chrome.google.com/webstore/detail/talkroom-screen-sharing/bacdhkkjdbghahbhopkgfijligodechn";
    }else if(_browser.firefox) {
        self.isPlugin = true;
    }else{
        debug.error("screen sharing not supported in your browser");
        self.isPlugin = false;
    }
    this.isExtensionInstall= (callback) => { 
        if(_browser.chrome) {
            var extensionImg = document.createElement("img");
            extensionImg.setAttribute("src",  "chrome-extension://bacdhkkjdbghahbhopkgfijligodechn/icon.png"); 
            extensionImg.addEventListener("load", (e)=> {
                self.isPlugin = true;
                callback(true);
            }, false);
            extensionImg.addEventListener("error", (e)=> {
                self.isPlugin = false;
                callback(false);
            }, false);
        }
    }
    getScreen = (callback) => {
        try{
            getScreenId( (error, sourceId, screen_constraints)=> {
                if(error) {
                    callback(error,null);
                    return
                }
                navigator.getUserMedia = navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
                navigator.getUserMedia(screen_constraints, (stream)=> {
                    callback(null,stream);
                }, (error)=> {
                    callback(error,null);
                });
            });
        }catch(e) {
            callback(error,null);
        }
    }

    this.addExtraStream =  ( stream )=> {
        if(this.canAddStream()) { attachExtraStream(stream); };
    }

    attachExtraStream = (stream) => {
        self.data.streams.push(stream.id);
        self.localstreams[stream.id] = stream;
        stream.type = 'local';
        self.onlocalstream({ stream: stream, data: self.data });
        self.socket.emit( "joinStream", stream.id, self.data , (rooms)=> {
            delete rooms[currentSocketId];
            self.remoteusers = rooms;
            self.peerAddStream(stream);
            makeOffer(stream.id);
        });
    }

    this.shareScreen = (callback)=> {

        debug.log("screen share start");
        if(!this.canAddStream()) {
            callback("no remote user");
        }else if(self.isPlugin || _browser.firefox) {
            getScreen((error,stream)=>{
                if(error || !stream){
                    callback(error);
                    return;
                }
                if(stream) {
                    self.addExtraStream(stream);
                    callback(null,stream);
                    return
                }
            });
        }else{
            callback("screen sharing is not supported");
        }
    }
}


//global utilily functions
function detectBrowser() {
    var _browser = {};
    var uagent = navigator.userAgent.toLowerCase(),
    match = '';

    _browser.chrome  = /webkit/.test(uagent)  && /chrome/.test(uagent)      &&
                    !/edge/.test(uagent);

    _browser.firefox = /mozilla/.test(uagent) && /firefox/.test(uagent);

    _browser.msie    = /msie/.test(uagent)    || /trident/.test(uagent)     ||
                    /edge/.test(uagent);

    _browser.safari  = /safari/.test(uagent)  && /applewebkit/.test(uagent) &&
                    !/chrome/.test(uagent);

    _browser.opr     = /mozilla/.test(uagent) && /applewebkit/.test(uagent) &&
                    /chrome/.test(uagent)  && /safari/.test(uagent)      &&
                    /opr/.test(uagent);

    _browser.version = '';

    for (var x in _browser) {
        if(_browser.hasOwnProperty(x)) {
            if (_browser[x]) {

                match = uagent.match( new RegExp("(" + (x === "msie" ? "msie|edge" : x) + ")( |\/)([0-9]+)") );

                if (match) {
                    _browser.version = match[3];
                } else {
                    match = uagent.match(new RegExp("rv:([0-9]+)"));
                    _browser.version = match ? match[1] : "";
                }
                break;
            }
        }
    }
    _browser.opera = _browser.opr;
    delete _browser.opr;
    return _browser
};
Object.size = function(obj) {
    var size = 0, key;
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};
Array.prototype.swap = function (x,y) {
    var b = this[x];
    this[x] = this[y];
    this[y] = b;
    return this;
}
function getSTUNObj(stunStr) {
    var urlsParam = 'urls';
    var obj = {};
    obj[urlsParam] = stunStr;
    return obj;
}

function getTURNObj(turnStr, username, credential) {
    var urlsParam = 'urls';
    var obj = {
        username: username,
        credential: credential
    };
    obj[urlsParam] = turnStr;
    return obj;
}
function Debug (gState) {

    var debug = {}

    if (gState) {
        for (var m in console){
            if (typeof console[m] == 'function') {
                debug[m] = console[m].bind(window.console[m])
            }
        }
    }else{
        for (var m in console) {
            if (typeof console[m] == 'function') {
                debug[m] = function (){};
            }
        }

        // var logger = document.getElementById('logger');
        // for (var m in console) {
        //     if (typeof console[m] == 'function') {
        //         debug[m] = function () {
        //             var str = ''
        //             for (var i = 1; i < arguments.length; i++) {
        //                 if (typeof arguments[i] == 'object') 
        //                     str += JSON && JSON.stringify ? JSON.stringify(arguments[i]) : arguments[i]+' '
        //                 else
        //                     str+=arguments[i]+' '
        //             }
        //             logger.innerHTML += str + '';
        //         }
        //     }
        // }
    }
  return debug
}
openwebrtc = function (){
    WebrtcObj = new Webrtc()
    return WebrtcObj;
}