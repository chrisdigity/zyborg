/* eslint-env node, es6 */
/* eslint-disable no-console */

/* sensitive data */
require("dotenv").config()

/**********************
 * USER CONFIGURATION *
 **********************/

/* Youtube Music Links */
const LINK_CHILLSTEP = 'https://www.youtube.com/watch?v=DLaV_7vwiN8'
const LINK_NCM = 'https://www.youtube.com/watch?v=Oxj2EAr256Y'
const LINK_NCS = 'https://www.youtube.com/watch?v=cQKuD49zKvU'

/* Channel IDs*/
const CHID_SPAM = '675644867447095296'
const CHID_SERVER = '651364689665720350'
const CHID_PRESENCE = '730596136938635334'
const CHID_VOICE = '720459302963380274'
const CHID_STORY = '651366291160170516' //voice
const CHID_ANIME = '730931465793044550' //voice
const CHID_CHILLSTEP = '725473321868591104' //muzix
const CHID_NCM = '766768566263087124' //muzix
const CHID_NCS = '766835115564859403' //muzix
const CHIDS_NOINTRO = [
   CHID_STORY, CHID_ANIME, CHID_CHILLSTEP, CHID_NCM, CHID_NCS,
]

/**************************
 * END USER CONFIGURATION *
 **************************/

/* required modules */
const FS = require("fs")
const Path = require("path")
const YTDL = require("ytdl-core")
const Discord = require("discord.js")
const DiscordTTS = require("discord-tts")

/* YTMusic constructor */
const VOLUME = 0.2
const YTMusic = function(n, id, src) {
  // make 'this' reliably accessible
  const _self = this
  
  // define options and parameters
  _self.name = n
  _self.chid = id
  _self.source = src
  _self.conn = null
  _self.count = 0
  // define the client
  _self.client = new Discord.Client()
  
  // setup events for the client...
  /* ...on ready, log event and post stream link */
  _self.client.on("ready", () => {
    console.log(`${_self.client.user.tag} is ready...`)
  })
  /* ...on voiceStateUpdate, check user joined before starting */
  _self.client.on("voiceStateUpdate", (old, cur) => {
    if(old.channelID != _self.chid && cur.channelID == _self.chid)
    {
      // user joined Chillstep ++increment count
      if(++_self.count == 1) {
        // start chillstep bot
        cur.member.voice.channel.join().then(connection => {
          _self.conn = connection
          connection.play(
            YTDL(_self.source, {quality:'highestaudio'}),
            {volume: VOLUME}
          ).on("error", error => {
            console.error(`${_self.name}: ${error}`)
            connection.disconnect()
            _self.conn = null
          })
        }).catch(console.error)
      }
    }
    else if(old.channelID == _self.chid && cur.channelID != _self.chid)
    {
      // user exited Chillstep --decrement count
      if(--_self.count < 0)
        _self.count = 0
      // check for lonely bot
      if(_self.count <= 1) {
        if(_self.conn) {
          // remove chillstep bot
          _self.conn.disconnect()
          _self.conn = null
        }
      }
    }
  })
  
  _self.destroy = function() {
    _self.client.destroy()
  }
  
  _self.login = function(token) {
    _self.client.login(token)
  }
}

/* Voice connection and dispatcher containers */
let Vconn = null
let Vqueue = []
let Vcooldown = {}

/* Initialize discord bots */
const Zyborg = new Discord.Client()
const ZJ_Chillstep = new YTMusic('ZJ_Chillstep', CHID_CHILLSTEP, LINK_CHILLSTEP)
const ZJ_NCM = new YTMusic('ZJ_NoCopyrightMusic', CHID_NCM, LINK_NCM)
const ZJ_NCS = new YTMusic('ZJ_NoCopyrightSounds', CHID_NCS, LINK_NCS)

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
Zyborg.on("message", message => {
  if(message.channel.id != CHID_SPAM || !message.member.hasPermission('ADMINISTRATOR'))
    return
  // check commands
  if(message.content.toLowerCase() == "!zyborg clearspam")
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
   if(action == 'joined' && cur.channel.members.array().length > 1 &&
      !CHIDS_NOINTRO.includes(cur.channelID)) {
     //join the channel
     let voiceChannel = cur.member.voice.channel
     voiceChannel.join().then(connection => {
        //create tts stream
        const stream = DiscordTTS.getVoiceStream(`**${cur.member.nickname || cur.member.user.username}** __*${action}*__ the chat.`)
       //play stream and leave
       const dispatcher = connection.play(stream);
       dispatcher.on("finish",()=>voiceChannel.leave())
     }).catch(console.error)
   }
})


// clean shutdown and restart on SIGTERM
process.once('SIGTERM', () => {
  console.log("SIGTERM detected. Restarting...")
  Zyborg.channels.fetch(CHID_SPAM).then(channel => {
    channel.send("```SIGTERM detected. Restarting...```").catch(console.error)
  }).catch(console.error)
  
  // destroy all bots
  Zyborg.destroy()
  ZJ_Chillstep.destroy()
  ZJ_NCM.destroy()
  ZJ_NCS.destroy()
  
  process.exit(101)
})

// bot logins
Zyborg.login(process.env.ZYBORG_TOKEN)
ZJ_Chillstep.login(process.env.ZJCHILLSTEP_TOKEN)
ZJ_NCM.login(process.env.ZJNOCOPYRIGHTMUSIC_TOKEN)
ZJ_NCS.login(process.env.ZJNOCOPYRIGHTSOUNDS_TOKEN)
