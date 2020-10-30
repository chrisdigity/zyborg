/* eslint-env node, es6 */
/* eslint-disable no-console */

/* required modules */
const YTDL = require("ytdl-core")
const DiscordTTS = require("discord-tts")
const { Client, Intents } = require("discord.js")
const { spawn } = require("child_process")

/* vars */
//let Vcurr = 0
let AlertQueue = []
let Vconnection = null
let MSGID_LASTSEEN = []
let UPDATE_OK = false
const Users = {}


/**********************
 * USER CONFIGURATION *
 **********************/

/* CONSTANTS */
const GMT = 10
const VOLUME = 0.1
const MSG_SPLIT_LENGTH = 1986
const MSG_SPLIT_SEP = '_*break*'
const VOICE_IDENTIFIER = '**#_Voice_GMT+10**'
const PRESENCE_IDENTIFIER = '**#_Presence_GMT+10**'
const JOINED = '*joined* <#'
const LEFT = '*left* <#'
const FROM = '*from* <#'
const TO = '*to* <#'

/* Youtube Music Links */
const LINK_CHILLSTEP = 'https://www.youtube.com/watch?v=N1FuK9KC1vc'
const LINK_NCM = 'https://www.youtube.com/watch?v=Oxj2EAr256Y'
const LINK_NCS = 'https://www.youtube.com/watch?v=Ioo-5ihWo6M'
const LINK_POP = 'https://www.youtube.com/watch?v=0obbr_bWdW0'

/* Role IDs */
const RID_ADMIN = '694657068220809287'

/* Channel IDs */
const CHID_SPAM = '675644867447095296'
const CHID_SERVER = '651364689665720350'
const CHID_LASTSEEN = '768828161864630333'
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

String.prototype.toGlobalRegExp = function() {
  /* fix special characters in provided string
   * ... $& means the whole matched string */
  return new RegExp(this.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'), 'g')
}

const HEROKU_RESTART = function() {
  spawn("heroku restart")
}

const BOT_ERROR = function(BOT, error) {
  BOT.channels.fetch(CHID_SPAM).then(channel => channel.send('BOT_ERROR():\n'+error).catch(console.error))
}

/* USER object */
const USER = function() {
  this.name = '_'
  this.presenceTime = 0
  this.presenceType = ''
  this.voiceTime = 0
  this.voiceFrom = null
  this.voiceTo = null
}

/* YTMusic constructor */
const YTMusic = function(n, id, src) {

  // make 'this' reliably accessible
  const _self = this
  
  // define options and parameters
  _self.name = n
  _self.chid = id
  _self.source = src
  _self.count = 0
  _self.conn = null
  _self.dispatcher = null
  _self.rejoin = false;
  
  // define the client
  _self.client = new Client({ ws: { intents: Intents.ALL } })
  
  // error strings
  const STREAM_URL_ERROR = 'TypeError [ERR_INVALID_ARG_TYPE]: input stream: The "url" argument must be of type string. Received undefined'
  const STREAM_COOKIE_ERROR = 'Error: input stream: Error parsing info: Cookie header used in request, but unable to find YouTube identity token'
  const STREAM_METADATA_ERROR = 'Error: input stream: Error parsing info: Unable to retrieve video metadata'
  const STREAM_REQUESTS_ERROR = 'Error: input stream: Status code: 429'
  const STREAM_ENDED_ERROR = 'Error: input stream: This live stream recording is not available.'
  
  // standard methods
  const playYT = connection => {
    _self.conn = connection
    // check listeners still exist
    if(connection.channel.members.array().length == 1) {
      _self.disconnect()
      return;
    }
    // dispatch yt stream
    _self.dispatcher = connection.play(YTDL(_self.source, {quality:'highestaudio'}),
                                       {volume: VOLUME})
    _self.dispatcher.on("finish", _self.disconnect)
    _self.dispatcher.on("error", error => {
      // recoverable errors
      if(error == STREAM_URL_ERROR || error == STREAM_COOKIE_ERROR ||
         error == STREAM_METADATA_ERROR) {
        BOT_ERROR(_self.client, error)
        _self.rejoin = true
      }
      // UNrecoverable errors
      else if(error == STREAM_REQUESTS_ERROR) {
        BOT_ERROR(_self.client, `*${STREAM_REQUESTS_ERROR}\n*Attempting server switch. Please wait...*`)
        setTimeout(HEROKU_RESTART, 1000)
      }
      else if(error == STREAM_ENDED_ERROR)
        BOT_ERROR(_self.client, `${STREAM_ENDED_ERROR}\n*<@&${RID_ADMIN}>, the link provided for this livestream has ended.\nPlease update the link manually.*`)
      else BOT_ERROR(_self.client, error)
      // delayed disconnect, incase bot enters an infinite channel join/leave cycle
      setTimeout(_self.disconnect, 1000)
    })
  }
  
  _self.disconnect = () => {
    // stop and disconnect
    if(_self.dispatcher)
      _self.dispatcher.end()
    if(_self.conn)
      _self.conn.disconnect()
    // ensure nothing remains
    _self.dispatcher = null
    _self.conn = null
  }
  
  _self.destroy = () => {
    _self.disconnect()
    _self.client.destroy()
  }
  
  _self.login = (token) => {
    _self.client.login(token)
  }
  
  // setup events for the client...
  /* ...on ready, log event and join if members waiting */
  _self.client.on("ready", () => {
    console.log(`${_self.client.user.tag} is ready...`)
    _self.client.channels.fetch(_self.chid).then(channel => {
      if(channel.members) {
        _self.count = channel.members.array().length
        if(_self.count > 0)
          channel.join().then(playYT).catch(error => BOT_ERROR(_self.client, error))
      }
    }).catch(error => BOT_ERROR(_self.client, error))
  })
  /* ...on voiceStateUpdate, check user joined before starting */
  _self.client.on("voiceStateUpdate", (old, cur) => {
    const joining = Boolean(old.channelID != _self.chid && cur.channelID == _self.chid)
    const leaving = Boolean(old.channelID == _self.chid && cur.channelID != _self.chid)
    // don't count own bot movements
    if(cur.member.id == _self.client.user.id) {
      // if leaving, check rejoin
      if(leaving && _self.rejoin) {
        // join channel
        _self.channels.fetch(_self.chid).then(
          channel => channel.join().then(playYT).catch(
            error => BOT_ERROR(_self.client, error)
          )
        ).catch(error => BOT_ERROR(_self.client, error))
      }
      // if joining, check lonely
      else if(joining && _self.count < 1)
        _self.disconnect()
    }
    // all other user movements
    else if(joining) {
      // user joined Chillstep ++increment count and join
      if(++_self.count > 0)
        cur.member.voice.channel.join()
          .then(playYT).catch(error => BOT_ERROR(_self.client, error))
    } else if(leaving && --_self.count < 1) {
      // user exited, count was --decremented... disconnect
      _self.count = 0
      _self.disconnect()
    }
  })
}


/**********************
 * BOT INITIALIZATION *
 **********************/


const Zyborg = new Client({ ws: { intents: Intents.ALL } })
const ZJ_Pop = new YTMusic('ZJ_Pop', CHID_POP, LINK_POP)
const ZJ_Chillstep = new YTMusic('ZJ_Chillstep', CHID_CHILLSTEP, LINK_CHILLSTEP)
const ZJ_NCM = new YTMusic('ZJ_NoCopyrightMusic', CHID_NCM, LINK_NCM)
const ZJ_NCS = new YTMusic('ZJ_NoCopyrightSounds', CHID_NCS, LINK_NCS)

/**************************
 * END BOT INITIALIZATION *
 **************************/


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
const PLAY_NEXT_ALERT = connection => {
  // store current connection
  if(connection)
    Vconnection = connection
  
  if(AlertQueue[0].alert.length) {
    let alert = AlertQueue[0].alert.shift()
    Vconnection.play(
      DiscordTTS.getVoiceStream(alert.text, alert.lang)
    ).on("finish", PLAY_NEXT_ALERT)
  } else CHECK_ALERTS()
}

/* Zyborg function to check/play next alert */
const CHECK_ALERTS = () => {
  // remove empty alert queues
  if(AlertQueue.length && !AlertQueue[0].alert.length)
    AlertQueue.shift()
  // move to next alert channel
  if(Vconnection)
    Vconnection.disconnect()
  if(AlertQueue.length) {
    Zyborg.channels.fetch(AlertQueue[0].chid).then(channel => {
      channel.join().then(PLAY_NEXT_ALERT).catch(error => BOT_ERROR(Zyborg, error))
    }).catch(error => BOT_ERROR(Zyborg, error))
  }
}

/* Zyborg function to queue next alert */
const QUEUE_ALERT = function(next) {
  //debug
  console.log(next)
  // ignore NOINTRO channels
  if(CHIDS_NOINTRO.includes(next.chid))
    return;
  console.log('ACCEPTED')
  // scan queue to stack alerts, otherwise append...
  let i = 0
  for( ; i < AlertQueue.length; i++) {
    if(AlertQueue[i].chid == next.chid) {
      AlertQueue[i].alert.push(...next.alert)
      break;
    }
  }
  if(i == AlertQueue.length)
    AlertQueue.push(next)
  // activate alerts
  CHECK_ALERTS()
}

const UPDATE_USER = function(userid, update) {
  //create new user, if necessary
  if(!Users.hasOwnProperty(userid))
    Users[userid] = new USER()
  //update userid with update object
  for(const param in update)
    Users[userid][param] = update[param]
  
  if(!UPDATE_OK)
    return;
  
  let id = null
  let user = null
  let dateString = ''
  let orderedUsers = []
  //create message update
  let content = '```Time Format: GMT' + (GMT<0?'':'+') + GMT + '```\n'
  //sort Users by presence time
  Object.keys(Users).sort((a,b) => {
    return a.presenceTime - b.presenceTime
  }).forEach(key => orderedUsers.push(key))
  //include presence in content
  content += PRESENCE_IDENTIFIER + '\n'
  for(let i = 0; i < orderedUsers.length; i++) {
    id = orderedUsers[i]
    user = Users[id]
    if(user.presenceTime) {
      dateString = new Date(user.presenceTime + (GMT*60*60*1000)).toJSON().slice(0,16)
      content += user.presenceType
      content += `<@${id}> ${dateString}\n`
    }
  }
  content += '\n'
  //sort Users by presence time
  orderedUsers = []
  Object.keys(Users).sort((a,b) => {
    return a.voiceTime - b.voiceTime
  }).forEach(key => orderedUsers.push(key))
  //include voice in content
  content += VOICE_IDENTIFIER + '\n'
  for(let i = 0; i < orderedUsers.length; i++) {
    id = orderedUsers[i]
    user = Users[id]
    if(user.voiceTime) {
      let moved = Boolean(user.voiceFrom && user.voiceTo)
      dateString = new Date(user.voiceTime + (GMT*60*60*1000)).toJSON().slice(0,16)
      content += `<@${id}> ${dateString}\n`
      if(user.voiceFrom) {
        content += moved ? FROM : LEFT
        content += `${user.voiceFrom}>\n`
      }
      if(user.voiceTo) {
        content += moved ? TO : JOINED
        content += `${user.voiceTo}>\n`
      }
    }
  }
  //update message content
  Zyborg.channels.fetch(CHID_LASTSEEN).then(channel => {
    let i = 0
    while(content.length) {
      // obtain partial message content
      let contentPart = ''
      let splitIndex = content.substr(0,MSG_SPLIT_LENGTH).lastIndexOf('\n')
      if(splitIndex > -1)
        contentPart = content.substring(0, splitIndex)
      else contentPart = content.trimEnd()
      content = content.substr(splitIndex + 1)
      // append partial message separator
      contentPart += '\n' + MSG_SPLIT_SEP
      // handle partial message
      if(i < MSGID_LASTSEEN.length) {
        // edit MSGID_LASTSEEN[i] content
        channel.messages.fetch(MSGID_LASTSEEN[i]).then(message =>
          message.edit(contentPart).catch(error => BOT_ERROR(Zyborg, error))
        ).catch(error => BOT_ERROR(Zyborg, error))
      } else {
        // create additional message; add to MSGID_LASTSEEN array
        channel.send(contentPart).then(
          message => MSGID_LASTSEEN.push(message.id)
        ).catch(error => BOT_ERROR(Zyborg, error))
      }
      // increment msg index
      i++
    }
    // clear remaining messages
    while(i < MSGID_LASTSEEN.length) {
      channel.messages.fetch(MSGID_LASTSEEN[i++]).then(message =>
        message.edit(MSG_SPLIT_SEP).catch(error => BOT_ERROR(Zyborg, error))
      ).catch(error => BOT_ERROR(Zyborg, error))
    }
  }).catch(error => BOT_ERROR(Zyborg, error))
}


/**************************/
/* Begin ZYBORG events... */

/* ...on ready, log event and begin clear spam event */
Zyborg.on("ready", () => {
  console.log(`${Zyborg.user.tag} is ready...`)
  //obtain presence message id
  Zyborg.channels.fetch(CHID_LASTSEEN).then(channel => {
    channel.messages.fetch().then(messages => {
      let content = ''
      let recordType = 0 // 1: presence user/data, 2: voice user, 3: voice data
      let readID = null
      messages.each(message => {
        if(message.author.id == Zyborg.user.id) {
          MSGID_LASTSEEN.unshift(message.id)
          content = message.content + '\n' + content
        } else message.delete().catch(console.error)
      })
      content.split(/\r?\n/).forEach(line => {
        //filter bogus lines
        if(!line || line.includes(MSG_SPLIT_SEP))
          return;
        //decipher...
        if(line.includes(PRESENCE_IDENTIFIER))
          recordType = 1
        else if(line.includes(VOICE_IDENTIFIER))
          recordType = 2
        else if(recordType == 1) { //presence read
          line = line.replace('<@',',').replace('> ',',').split(',')
          //store user id and check for existing user
          readID = line[1]
          if(!Users.hasOwnProperty(readID))
            Users[readID] = new USER()
          //store presence data
          Users[readID].presenceTime = Date.parse(line[2]+ (GMT<0?'':'+') + GMT + ':00') 
          Users[readID].presenceType = line[0]
        } else if(recordType == 2) { //voice read
          //advance voice type
          recordType++
          //decipher line
          line = line.replace('<@','').replace('> ',',').split(',')
          //store user id and check for existing user
          readID = line[0]
          if(!Users.hasOwnProperty(readID))
            Users[readID] = new USER()
          //store voice time
          Users[readID].voiceTime = Date.parse(line[1] + (GMT<0?'':'+') + GMT + ':00')
        } else if(recordType == 3) { //voice read extended
          if(line.includes(FROM) || line.includes(LEFT)) {
            Users[readID].voiceFrom = line.replace(FROM.toGlobalRegExp(), '').replace(LEFT.toGlobalRegExp(), '').replace('>','')
            if(line.includes(FROM))
              return; //should have another line of data for user
          } else if(line.includes(TO) || line.includes(JOINED))
            Users[readID].voiceTo = line.replace(TO.toGlobalRegExp(), '').replace(JOINED.toGlobalRegExp(), '').replace('>','')
          //return former voice type
          recordType--
        }
      })
      //set UPDATE)OK
      UPDATE_OK = true
    }).catch(console.error)
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
      ).catch(error => BOT_ERROR(Zyborg, error))
   }).catch(error => BOT_ERROR(Zyborg, error))
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
      ).catch(error => BOT_ERROR(Zyborg, error))
   }).catch(error => BOT_ERROR(Zyborg, error))
})
/* ...on presenceUpdate, log update appropriately */
Zyborg.on("presenceUpdate", (old, cur) => {
  //debug
  
  //ignore ALL bot movements
  let member = cur.member
  if(member.user.bot)
    return;
  
  /* acquire presence data and log with a message */
  let id = member.id
  let platform = Object.keys(cur.clientStatus)[0] || null
  switch(platform) {
    case 'desktop': platform = ':desktop:'; break;
    case 'mobile': platform = ':mobile_phone:'; break;
    case 'web': platform = ':spider_web:'; break;
    default: platform = ':grey_question:'
  }
  //create update object
  const update = {
    presenceType: platform,
    presenceTime: Date.now()
  }
  //update user
  UPDATE_USER(id, update)
})
/* ...on voiceStateUpdate, log update appropriately */
Zyborg.on("voiceStateUpdate", (old, cur) => {
  //ignore ALL bot movements
  let state = cur.channelID ? cur : old
  let member = state.member
  if(member.user.bot)
    return;
  
   /* acquire voice data and action */
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
    voiceFrom: old.channelID,
    voiceTo: cur.channelID,
    voiceTime: Date.now()
  }
  //update user
  UPDATE_USER(member.id, update)

  //queue extra action advise
  const name = `${member.nickname || member.user.username}`
  const next = { chid: null, alert: { text: '', lang: 'en-AU' } }
  if(action == 'moved to') {
    next.chid = old.channelID
    next.alert.text = `${name} moved away from the chat.`
    QUEUE_ALERT(next)
  }
  if(action == 'streaming') {
    let activity = ''
    if(member.presence.activities) {
      let num_activities = member.presence.activities.length
      if(num_activities)
        activity = member.presence.activities[num_activities - 1].name
    }
    if(activity.toLowerCase() == 'custom status') activity = ''
    next.alert.text = `${name} started streaming ${activity}.`
  }
  else if(action == 'regressed')
    next.alert.text = `${name} stopped streaming.`
  else next.alert.text = `${name} ${action} the chat.`
  next.chid = state.channelID
  QUEUE_ALERT(next)
})


// clean shutdown and restart on SIGTERM
process.once('SIGTERM', () => {
  console.log("SIGTERM detected. Restarting...")
  Zyborg.channels.fetch(CHID_SPAM).then(channel => {
    channel.send("```SIGTERM detected. Restarting...```").catch(console.error)
  }).catch(console.error)
  
  // destroy all bots
  Zyborg.destroy()
  ZJ_Pop.destroy()
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
