const { Expo } = require('expo-server-sdk');



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
    constructor() {
        this.expo = new Expo();
        this.tokens = [];
    }

    async sendNotif(data) {
        if (!this.expo || !this.tokens) return;
        this.tokens.forEach(({ token }) => {
            let chunks = this.expo.chunkPushNotifications([{ ...data, to: token }])

            chunks.forEach(async chunk => {
                let ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
            })
        })
    }

    setTokens(newtokens) {
        this.tokens = newtokens;
    }
}


const notifs = new Notifications()
module.exports = { Notifications, notifs }

