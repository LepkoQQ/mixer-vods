const fetch = require('node-fetch');

const ENDPOINT = 'https://mixer.com/api/v1';

const getChannelId = username =>
  fetch(`${ENDPOINT}/channels/${username}`)
    .then(response => response.json())
    .then(json => json.id);

const getChannelVods = id =>
  fetch(`${ENDPOINT}/recordings?where=channelId:eq:${id}&order=createdAt:DESC`)
    .then(response => response.json());

module.exports = {
  getChannelId,
  getChannelVods,
};
