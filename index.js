/* eslint-env node, es6 */
/* eslint-disable no-console */

const { isModifier, voiceTable } = require('./modifier');

/* required modules */
const { get } = require('http');
const { PassThrough } = require('stream');
const { spawn } = require('child_process');
const {
  Client,
  Collection,
  Intents,
  MessageEmbed,
  Permissions
} = require('discord.js');
const {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
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
const ENDEDKEY = '__**ENDED:**__';
const FREEBIEKEY = '__**Freebie:**__';
const REWARDSKEY = '__**Rewards:**__';
const FreebieEmojis = [
  '🇦', '🇧', '🇨', '🇩', '🇪', '🇫', '🇬', '🇭', '🇮', '🇯', '🇰', '🇱', '🇲', '🇳', '🇴', '🇵'
];

const MS = {
  day: 1000 * 60 * 60 * 24,
  hour: 1000 * 60 * 60,
  minute: 1000 * 60,
  second: 1000
};

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

/* function to check for new day and process daily functions */
let LastHour = new Date().getHours();
const HourlyChecks = function (BOT) {
  // for each guild the bot is apart of...
  BOT.guilds.cache.each(async guild => {
    let i = 0; // loop iterator
    const now = Date.now(); // now timestamp
    const getRoleIdByName = (name) => {
      return (guild.roles.cache.find(r => r.name === name) || { id: 0 }).id;
    };// define recently active role ids
    const rActiveRoleId = getRoleIdByName('Recently Active');
    const rARoleIds = [
      getRoleIdByName('9 days ago'), getRoleIdByName('8 days ago'),
      getRoleIdByName('7 days ago'), getRoleIdByName('6 days ago'),
      getRoleIdByName('5 days ago'), getRoleIdByName('4 days ago'),
      getRoleIdByName('3 days ago'), getRoleIdByName('2 days ago'),
      getRoleIdByName('1 day ago')
    ];
    const getChannelWhereNameIncludes = (name) => {
      return guild.channels.cache.find(channel => channel.name.includes(name));
    };
    // check guild has a freebies channel (text channel)
    const freebiesChannel = getChannelWhereNameIncludes('freebies');
    if (freebiesChannel && freebiesChannel.type === 'GUILD_TEXT') {
      // scan messages of freebies in channel
      const freebiesMessages = await freebiesChannel.messages.fetch();
      freebiesMessages.each(async freebieMsg => {
        // split message content into lines of readable data
        const msgLines = freebieMsg.content.split('\n');
        const getLineIndexWhereLineStartsWith = (str) => {
          return msgLines.findIndex(line => line.startsWith(str));
        }; // get index of FreebieID and split ID values into fId
        const fIdIdx = getLineIndexWhereLineStartsWith(FREEBIEKEY);
        const fId = (msgLines[fIdIdx] || '').split(' ');
        // obtain epoch and submissionId from fId
        const epoch = Number(fId[1]);
        const submissionId = fId[3];
        // check freebies that have ended by checking epoch
        if (epoch && epoch < now) {
          msgLines[fIdIdx] = msgLines[fIdIdx].replace(FREEBIEKEY, ENDEDKEY);
          // IMMEDIATELY END THE FREEBIE, AVOIDING WINNER RECURSION
          await freebieMsg.edit(msgLines.join('\n'));
          // read submission message as json
          const submissionCh = getChannelWhereNameIncludes('submit-freebies');
          const submissionMsg = await submissionCh.messages.fetch(submissionId);
          const json = JSON.parse(submissionMsg);
          const rewards = new Collection();
          const winnerIds = []; // keep record of winners, by user.Iid
          // add reaction emoji and rewards as key value pairs in collection
          for (i = 0; i < json.rewards.length; i++) {
            rewards.set(FreebieEmojis[i], json.rewards[i]);
          }
          // process all options randomly
          while (rewards.size) {
            const rewardsKey = rewards.randomKey();
            const reward = rewards.get(rewardsKey);
            const reaction = freebieMsg.reactions.cache.find(reaction => {
              return reaction.emoji.toString() === rewardsKey;
            }); // get users of reaction, excluding bots and winners
            const users = await reaction.users.fetch(); // get non-winner users
            users.sweep(user => user.bot || winnerIds.includes(user.id));
            // partition candidates from recently active
            const members = new Collection();
            await Promise.allSettled(users.map(async user => {
              members.set(user.id, await guild.members.fetch(user.id));
            }));
            let candidates = members.partition(member => {
              return member.roles.cache.has(rActiveRoleId);
            });
            // disregard active candidates, if none
            if (candidates[0].size) candidates = candidates.shift();
            else candidates = candidates.pop();
            // select random candidate and add to winners, if any
            if (candidates && candidates.size) {
              const winner = candidates.random();
              winnerIds.push(winner.id);
              // LOG WINNERS IN CASE OF UNEXPECTED ERROR
              console.log(`${winner.user.tag} won: ${reward.name}`);
              // edit associated reward line with winner
              const rewardLine = getLineIndexWhereLineStartsWith(rewardsKey);
              msgLines[rewardLine] =
              `~~${msgLines[rewardLine]}~~\n^^ Winner: ${winner}`;
              // DM user with reward
              winner.send(
                '__**FREE GAME WOOT WOOT!!!**__\n' +
                `${reward.name}\n||${reward.key}||\n` +
                '*^^ Click this dark spoiler box*\n\n' +
                '*Unless specified, games are redeemable via Steam.*\n' +
                '*Steam Client -> ADD A GAME -> Activate a product on steam...*'
              ).catch(error => submissionCh.send(
                `@Admin, Failed to send __${reward.name}__ reward key ` +
                `to user ${winner} -> ${winner.tag}; ${error}`
              )).catch(console.error);
            }
            // drop reward from collection and continue
            rewards.delete(rewardsKey);
          }
          // send edited freebies message
          freebieMsg.edit(msgLines.join('\n')).catch(console.error);
        }
      });
    }
    // check new day trigger - progress recently active
    const ProgressActive = Boolean(new Date().getHours() < LastHour);
    LastHour = new Date().getHours();
    if (ProgressActive) {
      // for every member of this guild, progress recently active status
      guild.members.fetch().then(members => {
        members.each(member => {
          // only process members with Recently Active role
          if (member.roles.cache.has(rActiveRoleId)) {
            for (i = 0; i < rARoleIds.length; i++) { // find aeons ago
              if (member.roles.cache.has(rARoleIds[i])) break;
            } // check final aeons ago, remove recently active role
            if (i === 0) member.roles.remove(rActiveRoleId).catch(console.error);
            // check progressable aeons ago, add next / remove previous
            if (i > 0) member.roles.add(rARoleIds[i - 1]).catch(console.error);
            if (i < rARoleIds.length) {
              member.roles.remove(rARoleIds[i]).catch(console.error);
            }
          }
        });
      });
    }
  });
};

/* ZYBORG function to clear spam channel every ~24 hours */
const CLEAR_SPAM = function (BOT) {
  BOT.channels.fetch(CHID_SPAM).then(channel => {
    /* featch messages from channel */
    channel.messages.fetch().then(messages => {
      /* if more than 1 message ... */
      if (messages.size > 10) {
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
                name: 'Leveling, prefix: ( > )',
                value: 'View Leaderboard here: https://dash.gaiusbot.me/leaderboard/178819240227373056\n```>leaderboard me\n>level```'
              }, {
                name: 'Introduction Pronunciation, prefix: ( _ )',
                value: 'Test voices here: http://www.voicerss.org/api/demo.aspx\n```_lang Josef\n_lang cs-cz```'
              }, {
                name: 'Colour Preference, prefix: ( _ )',
                value: '*Available to Graphene rank only.*\nmagenta red orange yellow green cyan azure blue\n```_colour magenta\n_colour clear```'
              }, {
                name: 'Channel Music, prefix: ( - )',
                value: '*Ensure channel members are ok with tunes.*\n```-play Big Bootie 20\n-volume 20\n-pause```'
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
const PLAY_NEXT_ALERT = () => {
  if (!Vactive && AlertQueue.length) {
    Vactive = true;
    joinVoiceChannel({
      channelId: AlertQueue[0].channel.id,
      guildId: AlertQueue[0].channel.guild.id,
      adapterCreator: AlertQueue[0].channel.guild.voiceAdapterCreator
    }).once(VoiceConnectionStatus.Ready, PLAY_NEXT_ALERT);
  } else if (AlertQueue[0].alert.length) {
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
    player.once('error', PLAY_NEXT_ALERT);
    player.once(AudioPlayerStatus.Idle, PLAY_NEXT_ALERT);
    getVoiceConnection(AlertQueue[0].channel.guild.id).subscribe(player);
  } else {
    const lastAlert = AlertQueue.shift();
    if (AlertQueue.length) {
      joinVoiceChannel({
        channelId: AlertQueue[0].channel.id,
        guildId: AlertQueue[0].channel.guild.id,
        adapterCreator: AlertQueue[0].channel.guild.voiceAdapterCreator
      }).once(VoiceConnectionStatus.Ready, PLAY_NEXT_ALERT);
    } else {
      getVoiceConnection(lastAlert.channel.guild.id).disconnect();
      Vactive = false;
    }
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
  // activate alerts, ONLY IF NOT ALREADY ACTIVE
  if (!Vactive) PLAY_NEXT_ALERT();
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
  // start HourlyChecks
  setInterval(HourlyChecks.bind(null, Zyborg), MS.hour);
});

Zyborg.on('messageCreate', message => {
  const member = message.member;
  // ignore news updates from other servers AND bot messages
  if (!member || member.user.bot) return;
  else RESET_RECENT(member); // update recently active role if not a bot
  // command messages must be in spam channel
  if (message.channel.name === 'bot-spam') {
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
    } else if (msg[1] && ['_color', '_colour'].indexOf(msg[0]) > -1) {
      // check graphene rank
      if (member.roles.cache.find(role => role.name === 'Graphene')) {
        function getRoleByName (name) {
          const role = member.guild.roles.cache.find(role => role.name === name);
          return role && typeof role === 'object' ? role.id : null;
        }
        // define colors
        const colorIds = {
          magenta: getRoleByName('Magenta'),
          red: getRoleByName('Red'),
          bloodorange: getRoleByName('BloodOrange'),
          orange: getRoleByName('Orange'),
          yellow: getRoleByName('Yellow'),
          green: getRoleByName('Green'),
          cyan: getRoleByName('Cyan'),
          azure: getRoleByName('Azure'),
          blue: getRoleByName('Blue')
        };
        const addColor = colorIds[msg[1].toLowerCase()] || [];
        const hasColors = Object.values(colorIds).filter(roleId => {
          return member.roles.cache.has(roleId);
        }); // remove existing color/s
        member.roles.remove(hasColors).then(member => {
          if (Object.keys(colorIds).indexOf(msg[1].toLowerCase()) > -1) {
            return member.roles.add(addColor).then(() => {
              return message.reply('Colour preference changed successfully.');
            });
          } else if (msg[1].toLowerCase() === 'clear') {
            return message.reply('Colour preference cleared.');
          } else return message.reply('Colour preference unknown...');
        }).catch(error => {
          return message.reply(`Colour Preference failed: ${error}`);
        }).catch(console.error);
      }
    }
    // check admin commands
    if (!member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) return;
    const cmds = ['_clearspam', '_hourlychecks', '_restart'];
    if (cmds.includes(msg[0].toLowerCase())) message.react('👍');
    if (msg[0].toLowerCase() === '_clearspam') CLEAR_SPAM(Zyborg);
    if (msg[0].toLowerCase() === '_hourlychecks') HourlyChecks(Zyborg);
    if (msg[0].toLowerCase() === '_restart') HEROKU_RESTART();
  } else if (message.channel.name === 'submit-freebies') {
    // check admin permission
    if (!member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) return;
    try { // try JSON conversion
      const json = JSON.parse(message.content);
      // check json data meets all requirements
      if (!json || typeof json !== 'object') {
        message.reply('Invalid JSON').catch(console.error);
      } else if (!json.epoch || typeof json.epoch !== 'number') {
        message.reply('Invalid [epoch]').catch(console.error);
      } else if (!json.title || typeof json.title !== 'string') {
        message.reply('Invalid [title]').catch(console.error);
      } else if (!Array.isArray(json.rewards) || json.rewards.length < 1) {
        message.reply('Invalid [rewards]').catch(console.error);
      } else {
        for (let i = 0; i < json.rewards.length; i++) {
          const reward = json.rewards[i];
          if (!reward || typeof reward !== 'object') {
            message.reply(`Invalid reward[${i}] object`).catch(console.error);
          } else if (!reward.name || typeof reward.name !== 'string') {
            message.reply(`Invalid reward[${i}].name`).catch(console.error);
          } else if (!reward.key || typeof reward.key !== 'string') {
            message.reply(`Invalid reward[${i}].key`).catch(console.error);
          }
        }
        // submission is accepted, post raffle to freebies channel
        const freebiesCh =
          Zyborg.channels.cache.find(ch => ch.name.includes('freebies'));
        if (!freebiesCh) {
          message.reply('Could not find freebies channel').catch(console.error);
        } else {
          // build rewards string
          let rewardsStr = '';
          const date = new Date(json.epoch);
          const dateStr = date.toLocaleString('en-AU', {
            timeZone: 'Australia/Brisbane',
            timeStyle: 'long',
            dateStyle: 'full'
          });
          for (let i = 0; i < json.rewards.length; i++) {
            const reward = json.rewards[i];
            rewardsStr += `${FreebieEmojis[i]} ${reward.name}\n`;
          }
          const freebieMessage =
            '*@everyone, a wild freebie has appeared...*\n\n' +
            `${FREEBIEKEY} ${date.getTime()} / ${message.id}\n\n` +
            `__**${json.title}**__\n\n` +
            '• To enter, simply click the reward emoji\'s below.\n' +
            '• You can choose all rewards, but you can only win ONE.\n' +
            '• Recently active members are rewarded first.\n' +
            `• Ends ${dateStr}\n\n` +
            `${REWARDSKEY}\n${rewardsStr}\n` + 'Good Luck!';
          // check if process was called with edited message
          if (json.edit) {
            freebiesCh.messages.fetch(json.edit).then(oldMessage => {
              oldMessage.edit(freebieMessage).catch(console.error);
            }).catch(error => {
              return message.reply(`Error editing freebie: ${error}`);
            }).catch(console.error);
          } else {
            freebiesCh.send(freebieMessage).then(sent => {
              // add reactions to message
              for (let i = 0; i < json.rewards.length; i++) {
                sent.react(FreebieEmojis[i]).catch(error => {
                  message.reply(
                    `Error adding reaction "${FreebieEmojis[i]}": ${error}`
                  ).catch(console.error);
                });
              }
            }).catch(error => {
              return message.reply(`Error: ${error}`);
            }).catch(console.error);
          }
        }
      }
    } catch (error) {
      message.reply(`Error parsing JSON data: ${error}`).catch(console.error);
    }
  }
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
  // detect erroneous repetition
  if (name.match(/(.{2,})[ ]\1+/gi) || name.match(/(.{2,})\1{2,}/gi)) {
    if (name === member.user.username) {
      // attempt to decode erroneous repetition
      let akaname = name.replace(/(.{2,})[ ]?\1+/gi, '$1');
      akaname = akaname.replace(/(.)\1{2,}/gi, '$1');
      name += `(ay kay ay, ${akaname})`;
    } else name += `(ay kay ay, ${member.user.username})`;
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
