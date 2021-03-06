import { Component, ViewChild } from '@angular/core';


import { Platform, MenuController, Nav } from 'ionic-angular';

import { Login } from '../pages/login/login';

import { StatusBar } from '@ionic-native/status-bar';
import { AndroidPermissions } from '@ionic-native/android-permissions';
import { SplashScreen } from '@ionic-native/splash-screen';


@Component({
    templateUrl: 'app.html'
})
export class MyApp {
    @ViewChild(Nav) nav: Nav;

    // make Login the root (or first) page
    rootPage = Login;
    pages: Array<{title: string, component: any}>;

    constructor(
        public platform: Platform,
        public menu: MenuController,
        public statusBar: StatusBar,
        public splashScreen: SplashScreen,
        public androidPermissions: AndroidPermissions,
    ) {
        this.initializeApp();

      // set our app's pages
        this.pages = [
          { title: 'My login Page', component: Login },
        ];
        
  }

  initializeApp() {
    this.platform.ready().then(() => {
      console.log('Platform ready');
      // Okay, so the platform is ready and our plugins are available.
      // Here you can do any higher level native things you might need.
      this.statusBar.styleDefault();
      this.splashScreen.hide();
      this.addPermissions(this.androidPermissions.PERMISSION.CAMERA);
      this.addPermissions(this.androidPermissions.PERMISSION.MICROPHONE);
      this.addPermissions(this.androidPermissions.PERMISSION.RECORD_AUDIO);
      this.addPermissions(this.androidPermissions.PERMISSION.MODIFY_AUDIO_SETTINGS);
    });
  }

    openPage(page) {
      // close the menu when clicking a link from the menu
      this.menu.close();
      // navigate to the new page if it is not the current page
      this.nav.setRoot(page.component);
    }

    

    addPermissions(androidPermission: any) {
      if (!this.platform.is('cordova')) {
        return false;
      }
      this.androidPermissions.checkPermission(androidPermission).then(
          (status) =>{ 
            if(!status.hasPermission){
              this.androidPermissions.requestPermission(androidPermission);
            }
          },
          err => this.androidPermissions.requestPermission(androidPermission)
        );
    }


}
