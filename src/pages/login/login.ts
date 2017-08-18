import { Component } from '@angular/core';
import { NavController } from 'ionic-angular';
import { Call } from '../call/call';

@Component({
  	selector: 'page-login',
  	templateUrl: 'login.html'
})
export class Login {
	username:string = 'Guest';
	roomname:string = 'galaxy';
	constructor(private navController: NavController) {

	}

	// increment product qty
	submitform() {
		console.log(this.username, this.roomname);

		this.navController.push(Call, {
			username: this.username, roomname: this.roomname
		});
	}
}
