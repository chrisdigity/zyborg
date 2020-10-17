/* eslint-env node, es6 */
/* eslint-disable no-console */

const ytdl = require("ytdl-core")
const Discord = require("discord.js")

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
            ytdl(_self.source, {quality:'highestaudio'}),
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

exports.module = {
  YTMusic,
}