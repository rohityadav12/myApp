import { ViewChild, Component } from '@angular/core';

import { NavController, NavParams,Navbar } from 'ionic-angular';
declare function openwebrtc();


@Component({
  	selector: 'page-call',
  	templateUrl: 'call.html'
})
export class Call {
	@ViewChild('local') local:any;
	@ViewChild(Navbar) navBar: Navbar;
  	username:any;
	roomname:any;
	webrtc:any;
	localstreamid:string;
	remotestreams:Array<any> = [];
	allDevices = { audioDevices:[], videoDevices:[] };
	selectedDevice = { audio:'',video:''};
	 

	//console.log(openwebrtc);

  	constructor(public navCtrl: NavController, public navParams: NavParams) {
    	// If we navigated to this page, we will have an item available as a nav param
    	this.username = navParams.get('username');
    	this.roomname = navParams.get('roomname');
    	this.webrtc = openwebrtc();
		this.webrtc.data.username = this.username || "Guest";
		this.webrtc.roomid= this.roomname || "webrtc";
    	this.webrtc.data.streamStatus = {};
		console.log('this.webrtc', JSON.stringify(this.webrtc) );
    	this.webrtc.joinroom();
        this.webrtc.getDevices((devices) => {
            this.allDevices.audioDevices = Object.keys(devices.audioIp).map(function (key) { return devices.audioIp[key]; });
            this.allDevices.videoDevices = Object.keys(devices.videoIp).map(function (key) { return devices.videoIp[key]; });
            console.log('allDevices', this.allDevices);
    
        });
    	this.webrtc.onlocalstream = (event)=>{
    		if(this.localstreamid === undefined) {
    			this.localstreamid = event.stream.id;
    		}
			this.webrtc.data.streamStatus[this.localstreamid] = {audio:!!event.stream.getAudioTracks(),video:!!event.stream.getVideoTracks()};

			let _video=this.local.nativeElement;
			_video.srcObject = event.stream;
            _video.play();
		}
		this.webrtc.onremotestream = (event)=>{
			console.log('remote',event);
			this.remotestreams.unshift(event);
		}
		this.webrtc.onRemoteStreamended = event => {
        	this.deleteByStreamid(event.streamid);
    	}
		this.webrtc.ondisconnect = event => {
			this.deleteByUserid(event.data.userid);
		}
  	}

  	ionViewDidLoad() {
    	this.navBar.backButtonClick = (e:UIEvent)=>{
     		// todo something
     		this.webrtc.closeRoom();

     		this.navCtrl.pop()
    	}
  	}
	getByStreamid (streamid:string) {
        var myindex = -1;
        if(this.remotestreams.length) {
            this.remotestreams.forEach((event,index)=>{
                if(event.stream.id === streamid){
                    myindex = index;
                }
            })
        }
        if(myindex === -1){ console.error('unexpected error'); }
        return myindex;
    }
	deleteByStreamid(streamid:string) {
        var index = this.getByStreamid(streamid);
        if( index === -1 ) { console.error('unexpected error'); return false; }
        this.remotestreams.splice(index, 1);
    }
	getByUserid(userid:string) {
        var myindex = [];
        if(this.remotestreams.length) {
            this.remotestreams.forEach((event,index)=>{
                if(event.data.userid === userid){
                    myindex.push(index);
                }
            })
        }
        return myindex;
    }
	deleteByUserid(userid:string) {
        var indexArr = this.getByUserid(userid);
        if(indexArr.length){
            for (var i = indexArr.length -1; i >= 0; i--)
            this.remotestreams.splice(indexArr[i],1);
        }
    }
    switchDevice(event:any) {
    	console.log('switchDevice',this.selectedDevice,event);
    	var constraint = this.webrtc.getConstraints( {audioId:this.selectedDevice.audio ,videoId:this.selectedDevice.video} );
        
        console.log('constraint',constraint);
        this.webrtc.switchStream(this.localstreamid, constraint, (error, newstream)=>{
            console.log('newstream', newstream);
            let _video=this.local.nativeElement;
			_video.srcObject = newstream;
            _video.play();
        });
    }
}
