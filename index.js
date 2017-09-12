import fs from 'fs';
import path from 'path';
import util from 'util';
import childProcess from 'child_process';
import cfonts from 'cfonts';
import inquirer from 'inquirer';
import inquirerHelpers from 'inquirer-helpers';
import inquirerAutocompletePrompt from 'inquirer-autocomplete-prompt';
import { distanceInWordsStrict, format } from 'date-fns';
import formatDuration from 'format-duration';
import commandExists from 'command-exists';
import { getChannelId, getChannelVods } from './mixerapi';

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

inquirer.registerPrompt('autocomplete', inquirerAutocompletePrompt);

cfonts.say('Mixer VODs!', {
  colors: ['yellow', 'blue'],
});

(async function main() {
  try {
    const usernamesPath = path.resolve(__dirname, 'usernames.json');

    let savedUsernames = {};
    let savedUsernameKeys = [];
    if (fs.existsSync(usernamesPath)) {
      savedUsernames = await readFile(usernamesPath, 'utf8').then(data => JSON.parse(data));
      savedUsernameKeys = Object.keys(savedUsernames);
    }

    const { username } = await inquirer.prompt({
      type: 'autocomplete',
      name: 'username',
      message: 'Whoose VODs do you want to see?',
      async source(answers, input) {
        if (input) {
          return [
            input,
            ...savedUsernameKeys.filter(e => e.toLowerCase().startsWith(input.toLowerCase())),
          ];
        }
        return savedUsernameKeys;
      },
    });

    let channelId = savedUsernames[username];
    if (!channelId) {
      channelId = await getChannelId(username);
      if (!channelId) {
        return console.log(`No user with name '${username}' found!`);
      }
      savedUsernames[username] = channelId;
      savedUsernameKeys.push(username);
      await writeFile(usernamesPath, JSON.stringify(savedUsernames), 'utf8');
    }

    const vods = await getChannelVods(channelId);

    if (!vods || !vods.length) {
      return console.log(`No VODs for user '${username}' found!`);
    }

    const vodTable = vods.map((vod) => {
      const date = new Date(vod.createdAt);
      const timeAgo = distanceInWordsStrict(Date.now(), date, { addSuffix: true });
      const isoDate = format(date, 'YYYY-MM-DD HH:mm');
      return [vod.name, formatDuration(vod.duration * 1000), `${timeAgo} (${isoDate})`];
    });
    const vodIds = vods.map(vod => vod.id);

    const vod = await inquirerHelpers.table('What VOD you want to watch?', vodTable, vodIds);

    try {
      await commandExists('streamlink');
    } catch (_) {
      return console.log("Could not find 'streamlink' executable. Make sure it is installed and included in your PATH.");
    }

    // need to use "beam.pro" since streamlink doesn't recognise "mixer.com" and the old domain
    // redirects to the new one anyway
    childProcess.spawn('streamlink', [`https://beam.pro/${username}?vod=${vod}`, 'best'], { stdio: 'inherit' });
    return console.log('Started streamlink. Exiting.');
  } catch (error) {
    return console.error(error);
  }
}());
