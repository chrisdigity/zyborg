/* eslint-env node, es6 */
/* eslint-disable no-console */

/* sensitive data */
require("dotenv").config()

/* vars */
//let Vcurr = 0
let Vqueue = []
let Vconnection = null
const Users = {}
let MSGID_PRESENCE = null
let UPDATE_OK = false


/**********************
 * USER CONFIGURATION *
 **********************/

/* CONSTANTS */
const GMT10 = 1000*60*60*10
const VOLUME = 0.1
const VOICE_IDENTIFIER = '**#_Voice_GMT+10**'
const PRESENCE_IDENTIFIER = '**#_Presence_GMT+10**'

/* Youtube Music Links */
const LINK_CHILLSTEP = 'https://www.youtube.com/watch?v=DLaV_7vwiN8'
const LINK_NCM = 'https://www.youtube.com/watch?v=Oxj2EAr256Y'
const LINK_NCS = 'https://www.youtube.com/watch?v=cQKuD49zKvU'
const LINK_POP = 'https://www.youtube.com/watch?v=0obbr_bWdW0'

/* Channel IDs */
const CHID_SPAM = '675644867447095296'
const CHID_SERVER = '651364689665720350'
const CHID_PRESENCE = '768828161864630333'
const CHID_ANIME = '730931465793044550' //voice
const CHID_CHILLSTEP = '725473321868591104' //muzix
const CHID_NCM = '766768566263087124' //muzix
const CHID_NCS = '766835115564859403' //muzix
const CHID_POP = '768594119341375489' //muzix
const CHIDS_NOINTRO = [
   CHID_ANIME, CHID_CHILLSTEP, CHID_NCM, CHID_NCS, CHID_POP,
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

const USER = function() {
  this.name = ''
  this.presenceTime = 0
  this.presenceType = ''
  this.voiceTime = 0
  this.voiceFrom = null
  this.voiceTo = null
}

const UPDATE_USER = function(BOT, userid, update) {
  //return if ready to update
  if(!UPDATE_OK)
    return;
  //create new user, if necessary
  if(!Users.hasOwnProperty(userid))
    Users[userid] = new USER()
  //update userid with update object
  for(const param in update)
    Users[userid][param] = update[param]
  //sort Users by name
  let orderedUsers = []
  Object.keys(Users).sort().forEach(key => orderedUsers.push(key))
  //create message update
  let content = '```All times are in GMT+10```\n'
  let voiceContent = VOICE_IDENTIFIER + '\n'
  let presenceContent = PRESENCE_IDENTIFIER + '\n'
  for(let i = 0; i < orderedUsers.length; i++) {
    let id = orderedUsers[i]
    let user = Users[id]
    let dateString = '*unknown date*'
    if(user.voiceTime) {
      let moved = Boolean(user.voiceFrom && user.voiceTo)
      dateString = new Date(user.voiceTime+GMT10).toJSON().slice(0,16)
      voiceContent += `<@${id}> ${dateString}\n`
      if(user.voiceFrom) {
        voiceContent += moved ? 'from' : 'left'
        voiceContent += ` <#${user.voiceFrom}>\n`
      }
      if(user.voiceTo) {
        voiceContent += moved ? 'to' : 'joined'
        voiceContent += ` <#${user.voiceTo}>\n`
      }
    }
    if(user.presenceTime && !(user.voiceFrom || user.voiceTo)) {
      dateString = new Date(user.presenceTime+GMT10).toJSON().slice(0,16)
      presenceContent += user.presenceType
      presenceContent += `<@${id}> ${dateString}\n`
    }
  }
  //update message content
  BOT.channels.fetch(CHID_PRESENCE).then(channel => {
    channel.messages.fetch(MSGID_PRESENCE).then(message => {
      message.edit(
        content + voiceContent + '\n' + presenceContent + '\n_'
      ).catch(console.error)
    }).catch(console.error)
  }).catch(console.error)
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
      }).catch(err => {
        console.error(err)
        if(Vconnection)
          Vconnection.disconnect()
        else console.log('NO VOICE CONNECTION TO DISCONNECT')
      })
    }
  } else if(Vconnection)
    Vconnection.disconnect()
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
const ZJ_Pop = new YTMusic('ZJ_Pop', CHID_POP, LINK_POP)


/**************************/
/* Begin ZYBORG events... */

/* ...on ready, log event and begin clear spam event */
Zyborg.on("ready", () => {
  console.log(`${Zyborg.user.tag} is ready...`)
  //obtain presence message id
  Zyborg.channels.fetch(CHID_PRESENCE).then(channel => {
    channel.messages.fetch().then(messages => {
      messages.each(message => {
        if(!MSGID_PRESENCE && message.author.id == Zyborg.user.id)
          MSGID_PRESENCE = message.id
        else message.delete().catch(console.error)
      })
    }).catch(console.error).finally(() => {
      if(!MSGID_PRESENCE)
        channel.send('```###```').then(message => {
          //set message id
          MSGID_PRESENCE = message.id
          //set update ok
          UPDATE_OK = true
        }).catch(console.error)
      else {
        //read presence data
        channel.messages.fetch(MSGID_PRESENCE).then(message => {
          let content = message.content.split(/\r?\n/)
          //obtain voice and presence index
          let v_index = content.findIndex(el => el.includes(VOICE_IDENTIFIER))
          let p_index = content.findIndex(el => el.includes(PRESENCE_IDENTIFIER))
          //read data
          if(v_index > 0) {
            console.log('VOICE->', content[v_index++])
            if(content[v_index])
              console.log('VOICEDATA->', content[v_index].replace('<@',',').replace('> ',',').split(','))
          }
          if(p_index > 0) {
            console.log('PRESENCE->', content[p_index++], content[p_index++])
            if(content[p_index])
              console.log('PRESENCEDATA->', content[p_index].replace('<@',',').replace('> ',',').split(','))
          }
          //set update ok
          UPDATE_OK = true
        }).catch(console.error)
      }
    })
  }).catch(console.error)
  //clear spam channel
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
  let id = cur.member.id
  let platform = Object.keys(cur.clientStatus)[0] || null
  switch(platform) {
    case 'desktop': platform = ':desktop:'; break;
    case 'mobile': platform = ':mobile_phone:'; break;
    case 'web': platform = ':spider_web:'; break;
    default: platform = ':grey_question:'
  }
  //create update object
  const update = {
    name: cur.member.nickname || cur.member.user.username,
    presenceType: platform,
    presenceTime: Date.now()
  }
  //update user
  UPDATE_USER(Zyborg, id, update)
})
/* ...on voiceStateUpdate, log update appropriately */
Zyborg.on("voiceStateUpdate", (old, cur) => {
  //ignore bot movements
  let state = cur.channelID ? cur : old
  let member = state.member
  let id = member.id
  if(id == Zyborg.user.id)
    return;
  
   /* acquire voice data and action */
   let voiceChannel = state.channel
   let action = 'moved to'

   /* conditional data */
   if(old.channelID == null) action = 'joined'
   else if(cur.channelID == null) action = 'left'
   else if(old.streaming && !cur.streaming) action = 'regressed'
   else if(cur.streaming && !old.streaming) action = 'streaming'
   else if(old.channelID == cur.channelID)
     return;  //ignore all other 'same channel' actions

  //create update object
  const update = {
    name: member.nickname || member.user.username,
    voiceFrom: old.channelID,
    voiceTo: cur.channelID,
    voiceTime: Date.now()
  }
  //update user
  UPDATE_USER(Zyborg, id, update)

  //queue extra action advise
  let name = `${member.nickname || member.user.username}`
  if(action == 'moved to')
    QUEUE_ALERT({"channel": old.channel, "speak": `${name} moved away from the chat.`})
  if(action == 'streaming') {
    let activity = ''
    if(member.presence.activities) {
      let num_activities = member.presence.activities.length
      if(num_activities)
        activity = member.presence.activities[num_activities - 1].name
    }
    if(activity.toLowerCase() == 'custom status') activity = ''
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
ZJ_Pop.login(process.env.ZJPOP_TOKEN)
