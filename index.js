/* eslint-env node, es6 */
/* eslint-disable no-console */

/* sensitive data */
require("dotenv").config()

/**********************
 * USER CONFIGURATION *
 **********************/

/* Channel IDs*/
const CHID_SPAM = '675644867447095296'
const CHID_SERVER = '651364689665720350'
const CHID_PRESENCE = '730596136938635334'
const CHID_VOICE = '720459302963380274'
const CHID_A2C = '651366291160170516'    //voice
const CHID_FOCUS = '651374941840867338'  //voice
const CHID_ANIME = '730931465793044550'  //voice
const CHID_CHILLSTEP = '725473321868591104'  //muzix
const CHIDS_NOINTRO = [
   CHID_A2C, CHID_FOCUS, CHID_ANIME, CHID_CHILLSTEP,
]

/**************************
 * END USER CONFIGURATION *
 **************************/


/* CONSTANTS */
const MINUTES10 = 10 * 60 * 1000

/* required modules */
const FS = require("fs")
const YTDL = require("ytdl-core")
const Path = require("path")
const Discord = require("discord.js")
const Zyborg = new Discord.Client()
const ZJChillstep = new Discord.Client()
const ZJChillstep_link = 'https://www.youtube.com/watch?v=DLaV_7vwiN8'
let ZJChillstep_conn = null
let ZJChillstep_count = 0

/* Voice connection and dispatcher containers */
let Vconn = null
let Vqueue = []
let Vcooldown = {}

/* ALL BOTS shutdown function */
const SHUTDOWN = function(exitcode) {
  Zyborg.destroy()
  ZJChillstep.destroy()
  
  process.exit(exitcode)
}

/* ZYBORG function to clear spam channel every ~24 hours */
const CLEAR_SPAM = function() {
   Zyborg.channels.fetch(CHID_SPAM).then(channel => {
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
const PLAY_NEXT_INTRO = function(connection) {
   /* store voice connection */
   if(!Vconn) Vconn = connection
   /* play next mp3 file */
   Vconn.play(Vqueue.shift()).on('finish', () => {
      if(Vqueue.length) PLAY_NEXT_INTRO()
      else {
         Vconn.disconnect()
         Vconn = null
      }
   })
}


/**************************/
/* Begin ZYBORG events... */

/* ...on ready, log event and begin clear spam event */
Zyborg.on("ready", () => {
   console.log(`${Zyborg.user.tag} is ready...`)
   CLEAR_SPAM()
})
/* ...on guildMemberAdd, log event (hello) */
Zyborg.on("guildMemberAdd", member => {
   /* send message */
   Zyborg.channels.fetch(CHID_SERVER).then(channel => {
      let name = member.user.tag
      if(member.nickname)
         name += `[${member.nickname}]`
      channel.send(
         `:white_check_mark: **${name}** just __entered__ the server :wave:`
      ).catch(console.error)
   }).catch(console.error)
})
/* ...on guildMemberRemove, log event (goodbye) */
Zyborg.on("guildMemberRemove", member => {
   /* send message */
   Zyborg.channels.fetch(CHID_SERVER).then(channel => {
      let name = member.user.tag
      if(member.nickname)
         name += `[${member.nickname}]`
      channel.send(
         `:x: **${name}** just __exited__ the server :call_me:`
      ).catch(console.error)
   }).catch(console.error)
})
/* ...on presenceUpdate, log update appropriately */
Zyborg.on("presenceUpdate", (old, cur) => {
   /* acquire presence data and log with a message */
   let platform = Object.keys(cur.clientStatus)[0] || '*unknown*'
   let action = 'went'

   /* conditional data */
   if(cur.status == 'online') action = 'came'

   /* send message */
   Zyborg.channels.fetch(CHID_PRESENCE).then(channel => {
      channel.send(
         `**${cur.member.nickname || cur.member.user.tag}** __*${action}*__ ${cur.status} (${platform})`
      ).catch(console.error)
   }).catch(console.error)
})
/* ...on voiceStateUpdate, log update appropriately */
Zyborg.on("voiceStateUpdate", (old, cur) => {
   /* acquire voice data and log with a message */
   let voice = cur.channelID ? cur.channel.name : old.channel.name
   let action = 'moved to'

   /* conditional data */
   if(old.channelID == null) action = 'joined'
   else if(cur.channelID == null) action = 'left'
   else if(old.streaming) action = 'regress'
   else if(cur.streaming) action = 'streaming'

   /* send message */
   Zyborg.channels.fetch(CHID_VOICE).then(channel => {
      channel.send(
         `**${cur.member.nickname || cur.member.user.tag}** __*${action}*__ ${voice}`
      ).catch(console.error)
   }).catch(console.error)

   /* INTRODUCTION SOUNDS
    * play fun sounds for people entering voice channels
    * - DOES NOT PLAY when moving between voice channels or streaming
    * - DOES NOT PLAY in CHIDS_NOINTRO channels
    * - DOES NOT PLAY if there is only one (1) other person in the channel
    * - DOES NOT PLAY if user ID is still in cooldown
    * - DOES NOT PLAY if no sound file exists for user ID */
   if(action == 'left') {
      Vcooldown[cur.id] = Date.now()
   } else if(action == 'joined' &&
             !CHIDS_NOINTRO.includes(cur.channelID) &&
             cur.channel.members.array().length > 2 &&
             (!Vcooldown.hasOwnProperty(cur.id) || Vcooldown[cur.id] < Date.now() - MINUTES10)) {
      /* check file exists */
      let mp3file = Path.join(__dirname, `./sound/${cur.id}.mp3`)
      if(FS.existsSync(mp3file)){
         /* queue intro sound */
         Vqueue.push(mp3file)
         /* join channel and/or play intro */
         if(!Vconn)
            cur.member.voice.channel.join().then(PLAY_NEXT_INTRO).catch(console.error)
      }
   }
})


/********************************/
/* Begin ZJChillstep events... */

/* ...on ready, log event and begin clear spam event */
ZJChillstep.on("ready", () => {
   console.log(`${ZJChillstep.user.tag} is ready...`)
})
/* ...on voiceStateUpdate, check appropriate music channel */
ZJChillstep.on("voiceStateUpdate", (old, cur) => {
  if(old.channelID != CHID_CHILLSTEP && cur.channelID == CHID_CHILLSTEP) {
    // user joined Chillstep ++increment count
    if(++ZJChillstep_count == 1) {
      // start chillstep bot
      cur.member.voice.channel.join().then(connection => {
        ZJChillstep_conn = connection
        connection.play(
          YTDL(ZJChillstep_link, {quality:'highestaudio'}),
          {volume: 0.25}
        ).on("error", error => {
          console.error(`ZJChillstep: ${error}`)
          Zyborg.channels.fetch(CHID_SPAM).then(channel => {
            channel.send(`ZJChillstep: ${error}\n*Attempting auto-fix via REBOOT...*`).catch(console.error)
          }).catch(console.error)
          // restart command
          SHUTDOWN(1)
        })
      }).catch(console.error)
    }
  } else if(old.channelID == CHID_CHILLSTEP && cur.channelID != CHID_CHILLSTEP) {
    // user exited Chillstep --decrement count
    if(--ZJChillstep_count < 0)
      ZJChillstep_count = 0
    // check for lonely bot
    if(ZJChillstep_count <= 1) {
      if(ZJChillstep_conn) {
        // remove chillstep bot
        ZJChillstep_conn.disconnect()
        ZJChillstep_conn = null
      }
    }
  }
})


process.once('SIGTERM', () => {
   console.log("Bot system restart detected...")
   Zyborg.channels.fetch(CHID_SPAM).then(channel => {
     channel.send(`Bot system restart detected...`).catch(console.error)
   }).catch(console.error)
   // restart command
   SHUTDOWN(101)
})

// bot logins
Zyborg.login(process.env.ZYBORG_TOKEN)
ZJChillstep.login(process.env.ZJCHILLSTEP_TOKEN)
