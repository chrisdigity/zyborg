/* eslint-env node, es6 */
/* eslint-disable no-console */

/* required modules */
const HTTPS = require("https")
const Stream = require("stream")
const GoogleTTS = require('google-tts-api')
const { Client, Intents } = require("discord.js")

/* vars */
//let Vcurr = 0
let Vactive = false
let AlertQueue = []
let MSGID_LASTSEEN = []
let UPDATE_OK = false
const Users = {}


/**********************
 * USER CONFIGURATION *
 **********************/

/* CONSTANTS */
const GMT = 10
const MSG_SPLIT_LENGTH = 1986
const MSG_SPLIT_SEP = '_*break*'
const VOICE_IDENTIFIER = '**#_Voice_GMT+10**'
const PRESENCE_IDENTIFIER = '**#_Presence_GMT+10**'
const JOINED = '*joined* <#'
const LEFT = '*left* <#'
const FROM = '*from* <#'
const TO = '*to* <#'

/* Channel IDs */
const CHID_SPAM = '675644867447095296'
const CHID_SERVER = '651364689665720350'
const CHID_LASTSEEN = '768828161864630333'
const CHID_STORY = '651366291160170516' //voice
const CHID_ANIME = '730931465793044550' //voice
const CHID_MUZIX = '768594119341375489' //voice
const CHID_AFK = '187013967615361024' //voice
const CHIDS_NOINTRO = [
   CHID_AFK, CHID_STORY, CHID_ANIME, CHID_MUZIX,
]

/**************************
 * END USER CONFIGURATION *
 **************************/

String.prototype.toGlobalRegExp = function() {
  /* fix special characters in provided string
   * ... $& means the whole matched string */
  return new RegExp(this.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'), 'g')
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

/**********************
 * BOT INITIALIZATION *
 **********************/

const Zyborg = new Client({ ws: { intents: Intents.ALL } })

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
  if(AlertQueue[0].alert.length) {
    let alert = AlertQueue[0].alert.shift()
    const stream = new Stream.PassThrough()
    GoogleTTS(alert.text, alert.lang, 1).then(url => {
      HTTPS.get(url, res => res.pipe(stream))
    }).catch(error => {
      AlertQueue[0].alert.unshift(alert)
      console.error(error)
      stream.end()
    })
    const dispatcher = connection.play(stream)
    dispatcher.on("finish", () => PLAY_NEXT_ALERT(connection))
    dispatcher.on("error", () => PLAY_NEXT_ALERT(connection))
  } else {
    AlertQueue.shift()
    Vactive = false
    connection.disconnect()
    setTimeout(CHECK_ALERTS,100)
  }
}

/* Zyborg function to check/play next alert */
const CHECK_ALERTS = () => {
  if(!Vactive && AlertQueue.length) {
    Vactive = true
    Zyborg.channels.fetch(AlertQueue[0].chid).then(channel => {
      channel.join().then(PLAY_NEXT_ALERT).catch(error => {
        Zyborg.voice.connections.each(connection => connection.disconnect())
        console.error(error)
        Vactive = false
        CHECK_ALERTS()
      })
    }).catch(error => BOT_ERROR(Zyborg, error))
  }
}

/* Zyborg function to queue next alert */
const QUEUE_ALERT = function(next) {
  // ignore NOINTRO channels
  if(CHIDS_NOINTRO.includes(next.chid))
    return;
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
  let alert = ''
  let lang = ''
/**
 * Acceptable languages...
 *  "af-ZA"|"am-ET"|"hy-AM"|"az-AZ"|"id-ID"|"ms-MY"|"bn-BD"|"bn-IN"|"ca-ES"|
 *  "cs-CZ"|"da-DK"|"de-DE"|"en-AU"|"en-CA"|"en-GH"|"en-GB"|"en-IN"|"en-IE"|
 *  "en-KE"|"en-NZ"|"en-NG"|"en-PH"|"en-SG"|"en-ZA"|"en-TZ"|"en-US"|"es-AR"|
 *  "es-BO"|"es-CL"|"es-CO"|"es-CR"|"es-EC"|"es-SV"|"es-ES"|"es-US"|"es-GT"|
 *  "es-HN"|"es-MX"|"es-NI"|"es-PA"|"es-PY"|"es-PE"|"es-PR"|"es-DO"|"es-UY"|
 *  "es-VE"|"eu-ES"|"fil-PH"|"fr-CA"|"fr-FR"|"gl-ES"|"ka-GE"|"gu-IN"|"hr-HR"|
 *  "zu-ZA"|"is-IS"|"it-IT"|"jv-ID"|"kn-IN"|"km-KH"|"lo-LA"|"lv-LV"|"lt-LT"|
 *  "hu-HU"|"ml-IN"|"mr-IN"|"nl-NL"|"ne-NP"|"nb-NO"|"pl-PL"|"pt-BR"|"pt-PT"|
 *  "ro-RO"|"si-LK"|"sk-SK"|"sl-SI"|"su-ID"|"sw-TZ"|"sw-KE"|"fi-FI"|"sv-SE"|
 *  "ta-IN"|"ta-SG"|"ta-LK"|"ta-MY"|"te-IN"|"vi-VN"|"tr-TR"|"ur-PK"|"ur-IN"|
 *  "el-GR"|"bg-BG"|"ru-RU"|"sr-RS"|"uk-UA"|"he-IL"|"ar-IL"|"ar-JO"|"ar-AE"|
 *  "ar-BH"|"ar-DZ"|"ar-SA"|"ar-IQ"|"ar-KW"|"ar-MA"|"ar-TN"|"ar-OM"|"ar-PS"|
 *  "ar-QA"|"ar-LB"|"ar-EG"|"fa-IR"|"hi-IN"|"th-TH"|"ko-KR"|"zh-TW"|
 *  "yue-Hant-HK"|"ja-JP"|"zh-HK"|"zh" */
  switch(member.id) {
    case '63497370255491072': lang = 'ru-RU'; break //san
    case '61432760933289984': lang = 'ja-JP'; break //lord anchan
    case '286829962743382017': lang = 'es-US'; break //jasuar
    case '449492304466673694': lang = 'ru-RU'; break //snookims
    case '111470862519066624': lang = 'fr-FR'; break //ronlet
    case '55656116759048192': lang = 'ar-AE'; break //khalil
    default: lang = 'en-AU'
  }
  const name = `${member.nickname || member.user.username}`
  if(action == 'streaming') {
    let activity = ''
    if(member.presence.activities) {
      let num_activities = member.presence.activities.length
      if(num_activities)
        activity = member.presence.activities[num_activities - 1].name
    }
    if(activity.toLowerCase() == 'custom status') activity = ''
    alert = `${name} started streaming ${activity}.`
  }
  else if(action == 'regressed')
    alert = `${name} stopped streaming.`
  else alert = `${name} ${action} the chat.`
  QUEUE_ALERT({ chid: state.channelID, alert: [{ text: alert, lang: lang }] })
  //additional leave alert
  if(action == 'moved to') {
    alert = `${name} moved away from the chat.`
    QUEUE_ALERT({ chid: old.channelID, alert: [{ text: alert, lang: lang }] })
  }
})


// clean shutdown and restart on SIGTERM
process.once('SIGTERM', () => {
  console.log("SIGTERM detected. Restarting...")
  Zyborg.channels.fetch(CHID_SPAM).then(channel => {
    channel.send("```SIGTERM detected. Restarting...```").catch(console.error)
  }).catch(console.error)
  
  // destroy bot
  Zyborg.destroy()
  
  process.exit(101)
})

// bot logins
Zyborg.login(process.env.ZYBORG_TOKEN)
