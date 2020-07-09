/* eslint-env node, es6 */
/* eslint-disable no-console */

/* sensitive data */
require("dotenv").config()

/**********************
 * USER CONFIGURATION *
 **********************/

/* Channel IDs*/
const CHID_SPAM = '675644867447095296'
const CHID_VOICE = '720459302963380274'
const CHID_PRESENCE = '730596136938635334'
const CHID_MUSIC = '725473321868591104'
const CHIDS_NOINTRO = [
   CHID_MUSIC,
]

/**************************
 * END USER CONFIGURATION *
 **************************/


/* required modules */
const FS = require("fs")
const Path = require("path")
const Discord = require("discord.js")
const Client = new Discord.Client()

/* function to clear spam channel every ~24 hours */
const CLEAR_SPAM = function() {
   Client.channels.fetch(CHID_SPAM).then(channel => {
      /* featch messages from channel */
      channel.messages.fetch().then(messages => {
         /* if more than 1 message ... */
         if(messages.array().length > 1) {
            /* ... remove all messages */
            messages.each(message => {
               message.delete().then(msg => {
                  console.log(`Deleted ${msg.channel.name} message, ID#${msg.id}...`)
               }).catch(console.error)
            })
            /* ... replace original adviseof auto clearing */
            channel.send(
               'Channel cleared...\n```Please be aware, messages in this channel will generally be removed on a daily basis.```'
            ).catch(console.error)
         }
      }).catch(console.error)
   }).catch(console.error)

   /* repeat clear event in ~24 hours *
   setTimeout(CLEAR_SPAM, 86400000) */
}

/* function to play intro sound */
const PLAY_INTRO = function(file) {
   /* clear existing dispatcher finish disconnect */
   if(Vdisp) Vdisp.on('finish', () => {})

   /* play mp3 file */
   Vdisp = Vconn.play(file)
   Vdisp.on('finish', () => {
      Vdisp = null
      Vconn.disconnect()
      Vconn = null
   })
}

/* Voice connection and dispatcher containers */
let Vconn = null
let Vdisp = null


/* Begin Client events... */

/* ...on disconnect, log event */
Client.on("disconnect", () => {
   console.log(`${Client.user.tag} disconnected...`)
})
/* ...on ready, log event and begin clear spam event */
Client.on("ready", () => {
   console.log(`${Client.user.tag} is ready...`)
   CLEAR_SPAM()
})
/* ...on presenceUpdate, log update appropriately */
Client.on("presenceUpdate", (old, cur) => {
   /* acquire presence data and log with a message */
   let platform = Object.keys(cur.clientStatus)[0] || '*unknown*'
   let action = 'went'

   /* conditional data */
   if(cur.status == 'online') action = 'came'

   /* send message */
   Client.channels.fetch(CHID_PRESENCE).then(channel => {
      channel.send(
         `**${cur.member.nickname || cur.member.user.tag}** __*${action}*__ ${cur.status} (${platform})`
      ).catch(console.error)
   }).catch(console.error)
})
/* ...on voiceStateUpdate, log update appropriately */
Client.on("voiceStateUpdate", (old, cur) => {
   /* acquire voice data and log with a message */
   let voice = cur.channelID ? cur.channel.name : old.channel.name
   let action = 'moved to'

   /* conditional data */
   if(old.channelID == null) action = 'joined'
   else if(cur.channelID == null) action = 'left'
   else if(old.streaming) action = 'regress'
   else if(cur.streaming) action = 'streaming'

   /* send message */
   Client.channels.fetch(CHID_VOICE).then(channel => {
      channel.send(
         `**${cur.member.nickname || cur.member.user.tag}** __*${action}*__ ${voice}`
      ).catch(console.error)
   }).catch(console.error)

   /* MUSIC CHANNEL
    * give instruction on how to use the music bot */
   if(cur.channelID == CHID_MUSIC) {
      Client.channels.fetch(CHID_SPAM).then(channel => {
         channel.send(
            `<@${cur.id}> The music channel is no longer automatic :cry:\n` +
            'Instead, you can enter the following command:\n' +
            '```!play https://soundcloud.com/chrisdigity/sets/2020-candidates```'
         ).catch(console.error)
      }).catch(console.error)
   }

   /* INTRODUCTION SOUNDS
    * play fun sounds for people entering voice channels
    * - DOES NOT PLAY when moving between voice channels or streaming
    * - DOES NOT PLAY in CHIDS_NOINTRO channels
    * - DOES NOT PLAY if there is only one (1) other person in the channel
    * - DOES NOT PLAY if no sound file exists for user ID */
   if(action != 'joined') return
   if(CHIDS_NOINTRO.includes(cur.channelID)) return
   if(cur.channel.members.array().length < 3) return

   let mp3file = Path.join(__dirname, `./sound/${cur.id}.mp3`)
   if(!FS.existsSync(mp3file)) return

   /* join channel and/or play intro */
   if(Vconn) PLAY_INTRO(mp3file)
   else
      cur.member.voice.channel.join().then(connection => {
         Vconn = connection
         PLAY_INTRO(mp3file)
      }).catch(console.error)
})

process.once('SIGTERM', () => {
   console.log("Destroying client before exit...")
   Client.destroy()
   process.exit(101)
})

Client.login(process.env.DISCORD_TOKEN)
