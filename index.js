/* eslint-env node, es6 */
/* eslint-disable no-console */

/* sensitive data */
require("dotenv").config()

/* vars */
//let Vcurr = 0
let Vqueue = []
let Vconnection = null

/**********************
 * USER CONFIGURATION *
 **********************/

/* CONSTANTS */
const VOLUME = 0.1

/* Youtube Music Links */
const LINK_CHILLSTEP = 'https://www.youtube.com/watch?v=DLaV_7vwiN8'
const LINK_NCM = 'https://www.youtube.com/watch?v=Oxj2EAr256Y'
const LINK_NCS = 'https://www.youtube.com/watch?v=cQKuD49zKvU'

/* Channel IDs*/
const CHID_SPAM = '675644867447095296'
const CHID_SERVER = '651364689665720350'
const CHID_PRESENCE = '730596136938635334'
const CHID_VOICE = '720459302963380274'
const CHID_ANIME = '730931465793044550' //voice
const CHID_CHILLSTEP = '725473321868591104' //muzix
const CHID_NCM = '766768566263087124' //muzix
const CHID_NCS = '766835115564859403' //muzix
const CHIDS_NOINTRO = [
   CHID_ANIME, CHID_CHILLSTEP, CHID_NCM, CHID_NCS,
]

/**************************
 * END USER CONFIGURATION *
 **************************/

/* YTMusic constructor */
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

/* ZYBORG function to clear spam channel every ~24 hours */
const CLEAR_SPAM = function(BOT) {
   BOT.channels.fetch(CHID_SPAM).then(channel => {
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

/* Zyborg function to play alert */
const PLAY_ALERT = function(alert) {
  //++Vcurr
  Vconnection.play(
    DiscordTTS.getVoiceStream(alert.speak, 'en-AU')
  ).on("finish",() => {
    //if(--Vcurr == 0) {
      Vconnection.disconnect()
      Vconnection = null
      CHECK_ALERT()
    //}
  })
}

/* Zyborg function to check/play next alert */
const CHECK_ALERT = function() {
  if(Vqueue.length) {
    let alert = Vqueue.shift()
    /* check alert eligibility
     * - must have at least one existing member in the channel
     * - channel MUST NOT be on exclusion list */
    if(alert.channel.members.array().length > 0 &&
       !CHIDS_NOINTRO.includes(alert.channel.id)) {
      alert.channel.join().then(connection => {
        Vconnection = connection
        PLAY_ALERT(alert)
      }).catch(console.error)
    }
  }
}

/* Zyborg function to queue next alert */
const QUEUE_ALERT = function(alert) {
  // play sound immediately if same channel
  if(Vconnection && Vconnection.channel.id == alert.channel.id)
    PLAY_ALERT(alert)
  else Vqueue.push(alert)
  // chceck alerts if no voice connection
  if(Vconnection == null)
    CHECK_ALERT()
}

/* required modules */
const YTDL = require("ytdl-core")
const Discord = require("discord.js")
const DiscordTTS = require("discord-tts")

/* Initialize discord bots */
const Zyborg = new Discord.Client()
const ZJ_Chillstep = new YTMusic('ZJ_Chillstep', CHID_CHILLSTEP, LINK_CHILLSTEP)
const ZJ_NCM = new YTMusic('ZJ_NoCopyrightMusic', CHID_NCM, LINK_NCM)
const ZJ_NCS = new YTMusic('ZJ_NoCopyrightSounds', CHID_NCS, LINK_NCS)


/**************************/
/* Begin ZYBORG events... */

/* ...on ready, log event and begin clear spam event */
Zyborg.on("ready", () => {
  console.log(`${Zyborg.user.tag} is ready...`)
  CLEAR_SPAM(Zyborg)
})
Zyborg.on("message", message => {
  if(message.channel.id != CHID_SPAM || !message.member.hasPermission('ADMINISTRATOR'))
    return
  // check commands
  if(message.content.toLowerCase() == "!zyborg clearspam")
    CLEAR_SPAM(Zyborg)
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
  //ignore bot movements
  let state = cur.channelID ? cur : old
  let member = state.member
  if(member.id == Zyborg.user.id)
    return;
  
   /* acquire voice data and action */
   let voice = state.channel.name
   let voiceChannel = state.channel
   let action = 'moved to'

   /* conditional data */
   if(old.channelID == null) action = 'joined'
   else if(cur.channelID == null) action = 'left'
   else if(old.streaming) action = 'regressed'
   else if(cur.streaming) action = 'streaming'
   else if(old.channelID == cur.channelID)
     return;  //ignore all other 'same channel' actions

   /* send message */
   Zyborg.channels.fetch(CHID_VOICE).then(channel => {
      channel.send(
         `**${member.nickname || member.user.tag}** __*${action}*__ ${voice}`
      ).catch(console.error)
   }).catch(console.error)

  //queue extra action advise
  let name = `${member.nickname || member.user.username}`
  if(action == 'moved to')
    QUEUE_ALERT({"channel": old.channel, "speak": `${name} moved away from the chat.`})
  if(action == 'streaming') {
    let activity = ''
    if(member.presence.activities) {
      let num_activities = member.presence.activities.length
      activity = member.presence.activities[num_activities].name
    }
    if(activity.toLowerCase() == 'custom status')
      activity = ''
    QUEUE_ALERT({"channel": voiceChannel, "speak": `${name} started streaming ${activity}.`})
  }
  else if(action == 'regressed')
    QUEUE_ALERT({"channel": voiceChannel, "speak": `${name} stopped streaming.`})
  else
    QUEUE_ALERT({"channel": voiceChannel, "speak": `${name} ${action} the chat.`})
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
