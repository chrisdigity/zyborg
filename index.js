/* eslint-env node, es6 */
/* eslint-disable no-console */

const VOICES = {
  Oda: 'ar-eg',
  Salim: 'ar-sa',
  Dimo: 'bg-bg', Catalan: 'bg-bg', Rut: 'bg-bg',
  Luli: 'zh-cn', Shu: 'zh-cn', Chow: 'zh-cn', Wang: 'zh-cn',
  Jia: 'zh-hk', Xia: 'zh-hk', Chen: 'zh-hk',
  Akemi: 'zh-tw', Lin: 'zh-tw', Lee: 'zh-tw',
  Nikola: 'hr-hr',
  Josef: 'cs-cz',
  Freja: 'da-dk',
  Daan: 'nl-be',
  Lotte: 'nl-nl', Bram: 'nl-nl',
  Zoe: 'en-au', Isla: 'en-au', Evie: 'en-au', Jack: 'en-au',
  Rose: 'en-ca', Clara: 'en-ca', Emma: 'en-ca', Mason: 'en-ca',
  Alice: 'en-gb', Nancy: 'en-gb', Lily: 'en-gb', Harry: 'en-gb',
  Eka: 'en-in', Jai: 'en-in', Ajit: 'en-in',
  Oran: 'en-ie',
  Linda: 'en-us', Amy: 'en-us', Mary: 'en-us', John: 'en-us', Mike: 'en-us',
  Aada: 'fi-fi',
  Emile: 'fr-ca', Olivia: 'fr-ca', Logan: 'fr-ca', Felix: 'fr-ca',
  Bette: 'fr-fr', Iva: 'fr-fr', Zola: 'fr-fr', Axel: 'fr-fr',
  Theo: 'fr-ch',
  Lukas: 'de-at',
  Hanna: 'de-de', Lina: 'de-de', Jonas: 'de-de',
  Tim: 'de-ch',
  Neo: 'el-gr',
  Rami: 'he-il',
  Puja: 'hi-in', Kabir: 'hi-in',
  Mate: 'hu-hu',
  Intan: 'id-id',
  Bria: 'it-it', Mia: 'it-it', Pietro: 'it-it',
  Hina: 'ja-jp', Airi: 'ja-jp', Fumi: 'ja-jp', Akira: 'ja-jp',
  Nari: 'ko-kr',
  Aqil: 'ms-my',
  Marte: 'nb-no', Erik: 'nb-no',
  Julia: 'pl-pl', Jan: 'pl-pl',
  Marcia: 'pt-br', Ligia: 'pt-br', Yara: 'pt-br', Dinis: 'pt-br',
  Leonor: 'pt-pt',
  Doru: 'ro-ro',
  Olga: 'ru-ru', Marina: 'ru-ru', Peter: 'ru-ru',
  Beda: 'sk-sk',
  Vid: 'sl-si',
  Juana: 'es-mx', Silvia: 'es-mx', Teresa: 'es-mx', Jose: 'es-mx',
  Camila: 'es-es', Sofia: 'es-es', Luna: 'es-es', Diego: 'es-es',
  Molly: 'sv-se', Hugo: 'sv-se',
  Sai: 'ta-in',
  Ukrit: 'th-th',
  Omer: 'tr-tr',
  Chi: 'vi-vn'
}

/* required modules */
const HTTP = require("http")
const Stream = require("stream")
const { spawn } = require("child_process")
const { Client, Intents, MessageEmbed } = require("discord.js")

/* vars */
//let Vcurr = 0
let Vactive = false
let AlertQueue = []
let MSGID_LASTSEEN = []
let UPDATE_OK = false
const Users = {}
const ActivityCache = []


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

/* Channel Categories */
const CHID_PRIVATE = '775678141767090206' //category
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
const RID_ACTIVE = '828874771985989642'
const RID_5DAGO = '830361562929561620'
const RID_4DAGO = '830361673306079253'
const RID_3DAGO = '830361747084410880'
const RID_2DAGO = '830361824922566657'
const RID_1DAGO = '830361876310654996'

/**************************
 * END USER CONFIGURATION *
 **************************/

const HEROKU_RESTART = function() {
  spawn("heroku restart")
}

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

const RESET_RECENT = function(member) {
  if (member.roles.cache.has(RID_5DAGO)) member.roles.remove(RID_5DAGO)
  if (member.roles.cache.has(RID_4DAGO)) member.roles.remove(RID_4DAGO)
  if (member.roles.cache.has(RID_3DAGO)) member.roles.remove(RID_3DAGO)
  if (member.roles.cache.has(RID_2DAGO)) member.roles.remove(RID_2DAGO)
  if (member.roles.cache.has(RID_1DAGO)) member.roles.remove(RID_1DAGO)
  if (!member.roles.cache.has(RID_ACTIVE)) member.roles.add(RID_ACTIVE)
}

/* ZYBORG function to clear spam channel every ~24 hours */
const CLEAR_SPAM = function(BOT) {
   BOT.channels.fetch(CHID_SPAM).then(channel => {
      /* for every member of this channel (should be everyone) ... */
      channel.members.each(member => {
        /* ... remove recently active role, if present */
        if (member.roles.cache.has(RID_ACTIVE)) {
          // advance level of activity
          if (member.roles.cache.has(RID_5DAGO)) {
            member.roles.remove(RID_5DAGO)
            member.roles.remove(RID_ACTIVE)
          } else if (member.roles.cache.has(RID_4DAGO)) {
            member.roles.remove(RID_4DAGO)
            member.roles.add(RID_5DAGO)
          } else if (member.roles.cache.has(RID_3DAGO)) {
            member.roles.remove(RID_3DAGO)
            member.roles.add(RID_4DAGO)
          } else if (member.roles.cache.has(RID_2DAGO)) {
            member.roles.remove(RID_2DAGO)
            member.roles.add(RID_3DAGO)
          } else if (member.roles.cache.has(RID_1DAGO)) {
            member.roles.remove(RID_1DAGO)
            member.roles.add(RID_2DAGO)
          } else member.roles.add(RID_1DAGO)
        }
      })
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
           const embed = new MessageEmbed()
             .setDescription('Available bot commands.')
             .setThumbnail('https://www.freepnglogos.com/uploads/discord-logo-png/discord-emoji-recurring-discord-perks-gaming-17.png')
             .addFields(
               {
                 name: 'Introduction Bot, prefix: ( _ )',
                 value: 'Test voices here: http://www.voicerss.org/api/demo.aspx\n```_lang Josef\n_lang cs-cz```'
               },
               {
                 name: 'Leveling Bot, prefix: ( > )',
                 value: 'View Leaderboard here: https://dash.gaiusbot.me/leaderboard/178819240227373056\n```>leaderboard me\n>level```'
               },
               {
                 name: 'Musit Bot, prefix: ( - )',
                 value: 'More commands here: https://groovy.bot/commands\n```-play (link or search query)\n-next\n-stop```'
               }
             )
             .setTimestamp()
            channel.send('Channel cleared...', embed).catch(console.error)
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
    const url = `http://api.voicerss.org/?key=${ process.env.VOICERSS_TOKEN }&hl=${ encodeURIComponent(alert.lang) }${ alert.voice ? '&v=' + encodeURIComponent(alert.voice) : '' }&c=mp3&f=48khz_16bit_stereo&src=${ encodeURIComponent(alert.text) }`
    HTTP.get(url, res => res.pipe(stream))
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
        console.error(error)
        //restart bot, restart rotation may be bad...
        HEROKU_RESTART()
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
  const member = message.member
  // ignore news updates from other servers
  if(!member) return
  // update recently active role if not a bot
  if(!member.user.bot) RESET_RECENT(member)
  // command messages must be in spam channel
  if(message.channel.id != CHID_SPAM) return
  // split message
  const msg = message.content.split(' ')
  // check basic commands
  if(msg[1] && msg[0].toLowerCase() == "_lang") {
    let name = message.member.nickname || message.member.user.username
    // modifier removal
    if(name.includes(', ['))
      name = name.substring(0, name.lastIndexOf(', ['))
    else if(name.includes(' ['))
      name = name.substring(0, name.lastIndexOf(' ['))
    else if(name.includes('['))
      name = name.substring(0, name.lastIndexOf('['))
    // end modifier removal
    message.member.setNickname(`${msg[2] || name}, [${msg[1]}]`).then(() => {
      return message.channel.send('Intro preference embeded in Nickname :thumbup:');
    }).catch(error => {
      console.error(error)
      message.channel.send(error.message).catch(console.error)
    })
  }
  // check admin commands
  if(!message.member.hasPermission('ADMINISTRATOR')) return
  if(msg[0].toLowerCase() == "_clearspam")
    CLEAR_SPAM(Zyborg)
  if(msg[0].toLowerCase() == "_restart")
    HEROKU_RESTART()
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
  //ignore ALL bot movements
  let member = cur.member
  if(member.user.bot)
    return;

  /* detect activities and enable private chats */
  if(cur.activities.length) {
    cur.activities.forEach(activity => {
      if(activity.type == 'PLAYING') {
        const Aname = activity.name
        const vchName = Aname.replace(/ /g, '_').replace(/\W/g, '').replace(/_/g, ' ');
        let vChannel = cur.guild.channels.cache.find(channel => channel.name === vchName)
        if(vChannel) {
          vChannel.updateOverwrite(cur.user.id, { VIEW_CHANNEL: true })
          .then(channel => channel.setPosition(0))
          .catch(console.error)
        }
        if(ActivityCache.indexOf(Aname) == -1) {
          ActivityCache.push(Aname)
          // check voice channel exists, else create
          if(!vChannel) {
            // create the channel
            cur.guild.channels.create(vchName, {
              type: 'voice',
              parent: CHID_PRIVATE
            })
            .then(channel => channel.lockPermissions())
            .then(channel => channel.updateOverwrite(cur.user.id, { VIEW_CHANNEL: true }))
            .then(channel => channel.setPosition(0))
            .catch(console.error)
            .finally(() => {
              // check max allowed channels, delete last
              const children = cur.guild.channels.resolve(CHID_PRIVATE).children.array()
              while(children.length >= 40) {
                let child;
                do {
                  child = children.length ? children.shift() : null;
                } while(child && child.type == 'voice' && child.members.size)
                if(child) child.delete('Private channels capped at 30').catch(console.error)
              }
            })
          }
        }
      }
    })
  }

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

  // update recently active role if not a bot
  if(!member.user.bot) RESET_RECENT(member)

  // disallow deafened users
  if(cur.channelID && cur.selfDeaf) cur.setChannel(CHID_AFK);

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
  let voice = 'isla'
  let lang = 'en-au'
  // obtain name, remove any ZALGO, and split modifiers
  let name = (member.nickname || member.user.username).replace(/([aeiouy]̈)|[̀-ͯ҉]/ig,'$1')
  if(name.includes('[') && name.includes(']')) {
    //handle modifiers
    const modifier = name.substring(name.lastIndexOf('[') + 1, name.lastIndexOf(']'))
    if(modifier) {
      if(VOICES[modifier]) {
        voice = modifier
        lang = VOICES[modifier]
      } else {
        voice = ''
        lang = modifier
      }
    }
    //reduce name
    name = name.substring(0, name.lastIndexOf('['))
  }
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
  //additional leave alert first
  if(action == 'moved to')
    QUEUE_ALERT({ chid: old.channelID, alert: [{ text: `${name} moved away from the chat.`, lang, voice }] })
  QUEUE_ALERT({ chid: state.channelID, alert: [{ text: alert, lang, voice }] })
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
