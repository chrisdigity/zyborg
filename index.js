/* eslint-env node, es6 */
/* eslint-disable no-console */

const { isModifier, voiceTable } = require('./modifier');

/* required modules */
const { get } = require('http');
const { PassThrough } = require('stream');
const { spawn } = require('child_process');
const { Client, Intents, MessageEmbed, Permissions } = require('discord.js');
const {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  NoSubscriberBehavior,
  VoiceConnectionStatus
} = require('@discordjs/voice');

/* vars */
// let Vcurr = 0
let Vactive = false;
let UPDATE_OK = false;
const Users = {};
const AlertQueue = [];
const MSGID_LASTSEEN = [];

/**********************
 * USER CONFIGURATION *
 **********************/

/* CONSTANTS */
const GMT = 10;
const MSG_SPLIT_LENGTH = 1986;
const MSG_SPLIT_SEP = '_*break*';
const VOICE_IDENTIFIER = '**#_Voice_GMT+10**';
const PRESENCE_IDENTIFIER = '**#_Presence_GMT+10**';
const JOINED = '*joined* <#';
const LEFT = '*left* <#';
const FROM = '*from* <#';
const TO = '*to* <#';

/* Channel IDs */
const CHID_SPAM = '675644867447095296';
const CHID_SERVER = '651364689665720350';
const CHID_LASTSEEN = '768828161864630333';
const CHID_STORY = '651366291160170516'; // voice
const CHID_ANIME = '730931465793044550'; // voice
const CHID_MUZIX = '768594119341375489'; // voice
const CHID_AFK = '187013967615361024'; // voice
const CHIDS_NOINTRO = [CHID_AFK, CHID_STORY, CHID_ANIME, CHID_MUZIX];
const RID_ACTIVE = '828874771985989642';
const RID_9AGO = '875974563949862952';
const RID_8AGO = '875974521214091335';
const RID_7AGO = '875974471540961280';
const RID_6AGO = '875973613277282345';
const RID_5AGO = '830361562929561620';
const RID_4AGO = '830361673306079253';
const RID_3AGO = '830361747084410880';
const RID_2AGO = '830361824922566657';
const RID_1AGO = '830361876310654996';

/**************************
 * END USER CONFIGURATION *
 **************************/

const HEROKU_RESTART = () => spawn('heroku restart');

// eslint-disable-next-line
String.prototype.toGlobalRegExp = function() {
  /* fix special characters in provided string
   * ... $& means the whole matched string */
  return new RegExp(this.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'), 'g');
};

/* USER object */
class USER {
  constructor () {
    this.name = '_';
    this.presenceTime = 0;
    this.presenceType = '';
    this.voiceTime = 0;
    this.voiceFrom = null;
    this.voiceTo = null;
  }
}

/**********************
 * BOT INITIALIZATION *
 **********************/
const ZyborgIntents =
  Intents.FLAGS.GUILDS |
  Intents.FLAGS.GUILD_MEMBERS |
  Intents.FLAGS.GUILD_VOICE_STATES |
  Intents.FLAGS.GUILD_PRESENCES |
  Intents.FLAGS.GUILD_MESSAGES |
  Intents.FLAGS.GUILD_MESSAGE_REACTIONS |
  Intents.FLAGS.DIRECT_MESSAGES |
  Intents.FLAGS.DIRECT_MESSAGE_REACTIONS |
  Intents.FLAGS.DIRECT_MESSAGE_TYPING;
const Zyborg = new Client({ intents: ZyborgIntents });

/**************************
 * END BOT INITIALIZATION *
 **************************/

const BOT_ERROR = (error) => {
  Zyborg.channels.fetch(CHID_SPAM).then(channel => {
    return channel.send('BOT_ERROR():\n' + error);
  }).catch(console.error);
};

const RESET_RECENT = (member) => {
  if (member.roles.cache.has(RID_9AGO)) member.roles.remove(RID_9AGO);
  if (member.roles.cache.has(RID_8AGO)) member.roles.remove(RID_8AGO);
  if (member.roles.cache.has(RID_7AGO)) member.roles.remove(RID_7AGO);
  if (member.roles.cache.has(RID_6AGO)) member.roles.remove(RID_6AGO);
  if (member.roles.cache.has(RID_5AGO)) member.roles.remove(RID_5AGO);
  if (member.roles.cache.has(RID_4AGO)) member.roles.remove(RID_4AGO);
  if (member.roles.cache.has(RID_3AGO)) member.roles.remove(RID_3AGO);
  if (member.roles.cache.has(RID_2AGO)) member.roles.remove(RID_2AGO);
  if (member.roles.cache.has(RID_1AGO)) member.roles.remove(RID_1AGO);
  if (!member.roles.cache.has(RID_ACTIVE)) member.roles.add(RID_ACTIVE);
};

/* ZYBORG function to clear spam channel every ~24 hours */
const CLEAR_SPAM = function (BOT) {
  BOT.channels.fetch(CHID_SPAM).then(channel => {
    // for every member of this channel (should be everyone)...
    channel.members.each(member => {
      // ... remove recently active role, if present
      if (member.roles.cache.has(RID_ACTIVE)) {
        // advance level of activity
        if (member.roles.cache.has(RID_9AGO)) {
          member.roles.remove(RID_9AGO);
          member.roles.remove(RID_ACTIVE);
        } else if (member.roles.cache.has(RID_8AGO)) {
          member.roles.remove(RID_8AGO);
          member.roles.add(RID_9AGO);
        } else if (member.roles.cache.has(RID_7AGO)) {
          member.roles.remove(RID_7AGO);
          member.roles.add(RID_8AGO);
        } else if (member.roles.cache.has(RID_6AGO)) {
          member.roles.remove(RID_6AGO);
          member.roles.add(RID_7AGO);
        } else if (member.roles.cache.has(RID_5AGO)) {
          member.roles.remove(RID_5AGO);
          member.roles.add(RID_6AGO);
        } else if (member.roles.cache.has(RID_4AGO)) {
          member.roles.remove(RID_4AGO);
          member.roles.add(RID_5AGO);
        } else if (member.roles.cache.has(RID_3AGO)) {
          member.roles.remove(RID_3AGO);
          member.roles.add(RID_4AGO);
        } else if (member.roles.cache.has(RID_2AGO)) {
          member.roles.remove(RID_2AGO);
          member.roles.add(RID_3AGO);
        } else if (member.roles.cache.has(RID_1AGO)) {
          member.roles.remove(RID_1AGO);
          member.roles.add(RID_2AGO);
        } else member.roles.add(RID_1AGO);
      }
    });
    /* featch messages from channel */
    channel.messages.fetch().then(messages => {
      /* if more than 1 message ... */
      if (messages.size > 1) {
        /* ... remove all messages */
        messages.each(message => {
          message.delete().then(msg => {
            console.log(`Deleted ${msg.channel.name} message, ID#${msg.id}...`);
          }).catch(console.error);
        });
        /* ... replace original adviseof auto clearing */
        channel.send({
          content: 'Channel cleared...',
          embeds: [
            new MessageEmbed()
              .setDescription('Available bot commands.')
              .setThumbnail('https://discord.com/assets/f9bb9c4af2b9c32a2c5ee0014661546d.png')
              .addFields({
                name: 'Introduction Bot, prefix: ( _ )',
                value: 'Test voices here: http://www.voicerss.org/api/demo.aspx\n```_lang Josef\n_lang cs-cz```'
              }, {
                name: 'Leveling Bot, prefix: ( > )',
                value: 'View Leaderboard here: https://dash.gaiusbot.me/leaderboard/178819240227373056\n```>leaderboard me\n>level```'
              }, {
                name: 'Musit Bot, prefix: ( ! )',
                value: 'Web App: https://rythm.fm/app/\nMore commands here: https://rythm.fm/docs/commands/\n```!play (link or search query)\n!next\n!stop```'
              }).setTimestamp()
          ]
        }).catch(console.error);
      }
    }).catch(console.error);
  }).catch(console.error);

  /* repeat clear event in ~24 hours *
  setTimeout(CLEAR_SPAM, 86400000) */
};

/* Zyborg function to play alert */
const PLAY_NEXT_ALERT = connection => {
  if (AlertQueue[0].alert.length) {
    const alert = AlertQueue[0].alert.shift();
    const stream = new PassThrough();
    const resource = createAudioResource(stream);
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
    });
    const url = 'http://api.voicerss.org/?key=' + process.env.VOICERSS_TOKEN +
      '&hl=' + encodeURIComponent(alert.lang) +
      (alert.voice ? '&v=' + encodeURIComponent(alert.voice) : '') +
      '&c=mp3&f=48khz_16bit_stereo&src=' + encodeURIComponent(alert.text);
    get(url, res => res.pipe(stream));
    player.play(resource);
    player.once(AudioPlayerStatus.Idle, () => PLAY_NEXT_ALERT(connection));
    player.once('error', () => PLAY_NEXT_ALERT(connection));
    connection.subscribe(player);
  } else {
    Vactive = false;
    AlertQueue.shift();
    connection.destroy();
    setTimeout(CHECK_ALERTS, 100);
  }
};

/* Zyborg function to check/play next alert */
const CHECK_ALERTS = () => {
  if (!Vactive && AlertQueue.length) {
    Vactive = true;
    const connection = joinVoiceChannel({
      channelId: AlertQueue[0].channel.id,
      guildId: AlertQueue[0].channel.guild.id,
      adapterCreator: AlertQueue[0].channel.guild.voiceAdapterCreator
    });
    connection.on(VoiceConnectionStatus.Ready, () => {
      PLAY_NEXT_ALERT(connection);
    });
  }
};

/* Zyborg function to queue next alert */
const QUEUE_ALERT = function (next) {
  // ignore NOINTRO channels
  if (CHIDS_NOINTRO.includes(next.channel.id)) return;
  // scan queue to stack alerts, otherwise append...
  let i;
  for (i = 0; i < AlertQueue.length; i++) {
    if (AlertQueue[i].channel.id === next.channel.id) {
      AlertQueue[i].alert.push(...next.alert);
      break;
    }
  }
  if (i === AlertQueue.length) AlertQueue.push(next);
  // activate alerts
  CHECK_ALERTS();
};

const UPDATE_USER = function (userid, update) {
  // create new user, if necessary
  if (!Users.hasOwnProperty(userid)) Users[userid] = new USER();
  // update userid with update object
  for (const param in update) Users[userid][param] = update[param];

  if (!UPDATE_OK) return;

  let id = null;
  let user = null;
  let dateString = '';
  let orderedUsers = [];
  // create message update
  let content = '```Time Format: GMT' + (GMT < 0 ? '' : '+') + GMT + '```\n';
  // sort Users by presence time
  Object.keys(Users).sort((a, b) => {
    return a.presenceTime - b.presenceTime;
  }).forEach(key => orderedUsers.push(key));
  // include presence in content
  content += PRESENCE_IDENTIFIER + '\n';
  for (let i = 0; i < orderedUsers.length; i++) {
    id = orderedUsers[i];
    user = Users[id];
    if (user.presenceTime) {
      dateString = new Date(user.presenceTime + (GMT * 60 * 60 * 1000))
        .toJSON().slice(0, 16);
      content += user.presenceType;
      content += `<@${id}> ${dateString}\n`;
    }
  }
  content += '\n';
  // ort Users by presence time
  orderedUsers = [];
  Object.keys(Users).sort((a, b) => {
    return a.voiceTime - b.voiceTime;
  }).forEach(key => orderedUsers.push(key));
  // include voice in content
  content += VOICE_IDENTIFIER + '\n';
  for (let i = 0; i < orderedUsers.length; i++) {
    id = orderedUsers[i];
    user = Users[id];
    if (user.voiceTime) {
      const moved = Boolean(user.voiceFrom && user.voiceTo);
      dateString = new Date(user.voiceTime + (GMT * 60 * 60 * 1000))
        .toJSON().slice(0, 16);
      content += `<@${id}> ${dateString}\n`;
      if (user.voiceFrom) {
        content += moved ? FROM : LEFT;
        content += `${user.voiceFrom}>\n`;
      }
      if (user.voiceTo) {
        content += moved ? TO : JOINED;
        content += `${user.voiceTo}>\n`;
      }
    }
  }
  // update message content
  Zyborg.channels.fetch(CHID_LASTSEEN).then(channel => {
    let i = 0;
    while (content.length) {
      // obtain partial message content
      let contentPart = '';
      const splitIndex = content.substr(0, MSG_SPLIT_LENGTH).lastIndexOf('\n');
      if (splitIndex > -1) contentPart = content.substring(0, splitIndex);
      else contentPart = content.trimEnd();
      content = content.substr(splitIndex + 1);
      // append partial message separator
      contentPart += '\n' + MSG_SPLIT_SEP;
      // handle partial message
      if (i < MSGID_LASTSEEN.length) {
        // edit MSGID_LASTSEEN[i] content
        channel.messages.fetch(MSGID_LASTSEEN[i]).then(message =>
          message.edit(contentPart).catch(BOT_ERROR)
        ).catch(BOT_ERROR);
      } else {
        // create additional message; add to MSGID_LASTSEEN array
        channel.send(contentPart).then(
          message => MSGID_LASTSEEN.push(message.id)
        ).catch(BOT_ERROR);
      }
      // increment msg index
      i++;
    }
    // clear remaining messages
    while (i < MSGID_LASTSEEN.length) {
      channel.messages.fetch(MSGID_LASTSEEN[i++]).then(message =>
        message.edit(MSG_SPLIT_SEP).catch(BOT_ERROR)
      ).catch(BOT_ERROR);
    }
  }).catch(BOT_ERROR);
};

/**************************/
/* Begin ZYBORG events... */

/* ...on ready, log event and begin clear spam event */
Zyborg.on('ready', () => {
  console.log(`${Zyborg.user.tag} is ready...`);
  // obtain presence message id
  Zyborg.channels.fetch(CHID_LASTSEEN).then(channel => {
    channel.messages.fetch().then(messages => {
      let content = '';
      let recordType = 0; // 1: presence user/data, 2: voice user, 3: voice data
      let readID = null;
      messages.each(message => {
        if (message.author.id === Zyborg.user.id) {
          MSGID_LASTSEEN.unshift(message.id);
          content = message.content + '\n' + content;
        } else message.delete().catch(console.error);
      });
      content.split(/\r?\n/).forEach(line => {
        // filter bogus lines
        if (!line || line.includes(MSG_SPLIT_SEP)) return;
        // decipher...
        if (line.includes(PRESENCE_IDENTIFIER)) recordType = 1;
        else if (line.includes(VOICE_IDENTIFIER)) recordType = 2;
        else if (recordType === 1) { // presence read
          line = line.replace('<@', ',').replace('> ', ',').split(',');
          // store user id and check for existing user
          readID = line[1];
          if (!Users.hasOwnProperty(readID)) Users[readID] = new USER();
          // store presence data
          Users[readID].presenceType = line[0];
          Users[readID].presenceTime = Date.parse(
            line[2] + (GMT < 0 ? '' : '+') + GMT + ':00');
        } else if (recordType === 2) { // voice read
          // advance voice type
          recordType++;
          // decipher line
          line = line.replace('<@', '').replace('> ', ',').split(',');
          // store user id and check for existing user
          readID = line[0];
          if (!Users.hasOwnProperty(readID)) Users[readID] = new USER();
          // store voice time
          Users[readID].voiceTime = Date.parse(
            line[1] + (GMT < 0 ? '' : '+') + GMT + ':00');
        } else if (recordType === 3) { // voice read extended
          if (line.includes(FROM) || line.includes(LEFT)) {
            Users[readID].voiceFrom = line.replace(FROM.toGlobalRegExp(), '')
              .replace(LEFT.toGlobalRegExp(), '').replace('>', '');
            if (line.includes(FROM)) return; // should have another line of data for user
          } else if (line.includes(TO) || line.includes(JOINED)) {
            Users[readID].voiceTo = line.replace(TO.toGlobalRegExp(), '')
              .replace(JOINED.toGlobalRegExp(), '').replace('>', '');
          }
          // return former voice type
          recordType--;
        }
      });
      // set UPDATE)OK
      UPDATE_OK = true;
    }).catch(console.error);
  }).catch(console.error);
  // clear spam channel
  CLEAR_SPAM(Zyborg);
  // check freebies channel
  // CHECK_FREEBIES();
});

Zyborg.on('messageCreate', message => {
  const member = message.member;
  // ignore news updates from other servers AND bot messages
  if (!member || member.user.bot) return;
  else RESET_RECENT(member); // update recently active role if not a bot
  // command messages must be in spam channel
  if (message.channel.id !== CHID_SPAM) return;
  // split message
  const msg = message.content.split(' ');
  // check basic commands
  if (msg[1] && msg[0].toLowerCase() === '_lang') {
    let name = member.nickname || member.user.username;
    // modifier removal
    if (name.includes(', [')) {
      name = name.substring(0, name.lastIndexOf(', ['));
    } else if (name.includes(' [')) {
      name = name.substring(0, name.lastIndexOf(' ['));
    } else if (name.includes('[')) {
      name = name.substring(0, name.lastIndexOf('['));
    }
    // end modifier removal
    member.setNickname(`${msg[2] || name}, [${msg[1]}]`).then(() => {
      return message.channel.send(
        'Intro preference embeded in Nickname :thumbup:');
    }).catch(error => {
      console.error(error);
      message.channel.send(error.message).catch(console.error);
    });
  }
  // check admin commands
  if (!member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) return;
  if (msg[0].toLowerCase() === '_clearspam') CLEAR_SPAM(Zyborg);
  if (msg[0].toLowerCase() === '_restart') HEROKU_RESTART();
});

/* ...on guildMemberAdd, log event (hello) */
Zyborg.on('guildMemberAdd', member => {
  // send message
  Zyborg.channels.fetch(CHID_SERVER).then(channel => {
    const nickname = member.nickname;
    const name = member.user.tag + (nickname ? `[${nickname}]` : '');
    channel.send(
      `:white_check_mark: **${name}** __entered__ the server`).catch(BOT_ERROR);
  }).catch(BOT_ERROR);
});

/* ...on guildMemberRemove, log event (goodbye) */
Zyborg.on('guildMemberRemove', member => {
  // send message
  Zyborg.channels.fetch(CHID_SERVER).then(channel => {
    const nickname = member.nickname;
    const name = member.user.tag + (nickname ? `[${nickname}]` : '');
    channel.send(`:x: **${name}** __exited__ the server`).catch(BOT_ERROR);
  }).catch(BOT_ERROR);
});

/* ...on presenceUpdate, log update appropriately */
Zyborg.on('presenceUpdate', (old, cur) => {
  // ignore ALL bot movements
  const member = cur.member;
  if (member.user.bot) return;

  // acquire presence data and log with a message
  let platform = Object.keys(cur.clientStatus)[0];
  switch (platform) {
    case 'desktop': platform = ':desktop:'; break;
    case 'mobile': platform = ':mobile_phone:'; break;
    case 'web': platform = ':spider_web:'; break;
    default: platform = ':grey_question:';
  }
  // update user
  UPDATE_USER(member.id, { presenceType: platform, presenceTime: Date.now() });
});

/* ...on voiceStateUpdate, log update appropriately */
const SelfDeafList = new Set();
Zyborg.on('voiceStateUpdate', (old, cur) => {
  // ignore ALL bot movements
  const state = cur.channelId ? cur : old;
  const member = state.member;
  if (member.user.bot) return;

  // deafened users are forced AFK because reasons
  if (cur.channelId && cur.selfDeaf) {
    SelfDeafList.add(cur.id); // place member on the silent warning list.
    setTimeout(async () => { // if, after 20 seconds, user remains on list...
      if (SelfDeafList.has(cur.id)) cur.setChannel(CHID_AFK); // ... set AFK
      SelfDeafList.delete(cur.id); // cleanup
    }, 20000);
  } else SelfDeafList.delete(cur.id);

  /* determine action */
  let action = 'moved to'; // default
  if (!old.channelId) action = 'joined';
  else if (!cur.channelId) action = 'left';
  else if (old.streaming && !cur.streaming) action = 'regressed';
  else if (cur.streaming && !old.streaming) action = 'streaming';
  else if (old.channelId === cur.channelId) return;
  // ^return - ignores all other 'same-channel' actions

  // update recently active role if not a bot
  RESET_RECENT(member);
  // update voice presence
  UPDATE_USER(member.id, {
    voiceFrom: old.channelId,
    voiceTo: cur.channelId,
    voiceTime: Date.now()
  });

  // queue extra action advise
  let alert, voice, lang;
  // obtain name ( using nickname as preference )
  let name = (member.nickname || member.user.username);
  // remove ZALGO for correct pronunciation
  name = name.replace(/([aeiouy]̈)|[̀-ͯ҉]/ig, '$1');
  // check name for voice modifiers
  if (name.includes('[') && name.includes(']')) {
    // handle preferred intro modifiers
    const mod = name.slice(name.lastIndexOf('[') + 1, name.lastIndexOf(']'));
    if (mod && isModifier(mod)) {
      if (voiceTable[mod]) {
        lang = voiceTable[mod];
        voice = mod;
      } else lang = mod;
    } // reduce name
    name = name.substring(0, name.lastIndexOf('['));
  } else { // 'en-au' intro locale
    lang = 'en-au';
    voice = 'isla';
  }
  // decode erroneous repetition
  if (name.match(/(.{2,})[ ]\1+/gi) || name.match(/(.{2,})\1{2,}/gi)) {
    let akaname = name.replace(/(.{2,})[ ]?\1+/gi, '$1');
    akaname = akaname.replace(/(.{2})\1+/gi, '$1');
    name += `(ay kay ay; ${akaname})`;
  }
  // detect action
  if (action === 'streaming') {
    const activity = member.presence.activities.find(activity => {
      return Boolean(activity.type === 'PLAYING');
    }) || { name: 'something' };
    alert = `${name} started streaming ${activity.name}.`;
  } else if (action === 'regressed') {
    alert = `${name} stopped streaming.`;
  } else alert = `${name} ${action} the chat.`;
  // additional leave alert, first?
  if (action === 'moved to') {
    QUEUE_ALERT({
      channel: old.channel,
      alert: [{ text: `${name} moved away from the chat.`, lang, voice }]
    });
  }
  QUEUE_ALERT({
    channel: state.channel,
    alert: [{ text: alert, lang, voice }]
  });
});

// clean shutdown and restart on SIGTERM
process.once('SIGTERM', () => {
  console.log('SIGTERM detected. Restarting...');
  Zyborg.channels.fetch(CHID_SPAM).then(channel => {
    channel.send('```SIGTERM detected. Restarting...```').catch(console.error);
  }).catch(console.error);
  // destroy bot, and process
  Zyborg.destroy();
  process.exit(101);
});

// bot logins
Zyborg.login(process.env.ZYBORG_TOKEN);
