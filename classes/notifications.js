const { Expo } = require('expo-server-sdk');
const { fetchCollection } = require('../firebase/firestore');


//NOTIF DATA SHAPE
// export interface FirebaseData {
//     title?: string;
//     message?: string;
//     subtitle?: string;
//     sound?: boolean | string;
//     vibrate?: boolean | number[];
//     priority?: AndroidNotificationPriority;
//     badge?: number;
//   }

class Notifications {
    constructor(){
        this.expo = new Expo();
        this.tokens = [];
    }

    async init(){
        if(!this.expo) return;
        this.tokens = await fetchCollection('tokens');
        global.tokens = this.tokens
    }

    async sendNotif(data){
        if(!this.expo || !this.tokens) return;

        this.tokens.forEach(({ token }) =>{
            let chunks = this.expo.chunkPushNotifications([{...data, to: token}])

            chunks.forEach(async chunk =>{     
                let ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
            })
        })


    }
}


const notifs = new Notifications()
module.exports = {Notifications, notifs}

