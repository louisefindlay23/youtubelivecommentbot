require('dotenv').config();

const { SlashCommandBuilder } = require('discord.js');
const exec = require('child_process').exec;
const fs = require('fs');

function downloadYTLiveChats(URL, callback) {
  // Install chat_downloader
  exec('pip install chat_downloader', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error installing chat_downloader: ${error.message}`);
      return callback(error);
    }

    console.log(`chat_downloader installed successfully: ${stdout}`);

    // Run chat_downloader to retrieve chat for the specified YouTube video
    exec(`chat_downloader ${URL} --output chat.txt`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error running chat_downloader: ${error.message}`);
        return callback(error);
      }

      formatChat(callback);
    });
  });
}

function formatChat(callback) {
  fs.readFile('chat.txt', 'utf8', (err, data) => {
    if (err) {
      console.error(`Error reading chat file: ${err.message}`);
      return callback(err);
    }

    // Process and format the chat data
    const formattedData = data
      .split('\n')
      .map(line => {
        // Remove characters up to and including the pipe
        const pipeIndex = line.indexOf('|');
        if (pipeIndex !== -1) {
          line = line.slice(pipeIndex + 1).trim();
        }

        // Add two asterisks at the start of each line
        line = '**' + line;

        // Find the position of the first colon
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          // Add two asterisks after the first colon
          line = line.slice(0, colonIndex + 1) + '**' + line.slice(colonIndex + 1);
        }

        return line;
      })
      .join('\n');

    fs.writeFile('chatFormatted.txt', formattedData, 'utf8', err => {
      if (err) {
        console.error(`Error writing formatted chat file: ${err.message}`);
        return callback(err);
      }

      console.log('File has been successfully formatted and saved.');
      callback(); // Call the callback to indicate completion
    });
  });
}

function splitMessage(message, limit = 2000) {
  const messages = [];
  while (message.length > limit) {
    let splitIndex = message.lastIndexOf('\n', limit);
    if (splitIndex === -1) splitIndex = limit;
    messages.push(message.slice(0, splitIndex));
    message = message.slice(splitIndex).trim();
  }
  if (message.length > 0) messages.push(message);
  return messages;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ytlivecomments')
    .setDescription('Replies with YT live comments')
    .addStringOption(option =>
      option.setName('url')
      .setDescription('The URL of the YT video')
      .setRequired(true)),
  async execute(interaction) {
    const URL = interaction.options.getString('url');
    if (!URL || !URL.startsWith('https://www.youtube.com/watch?v=')) {
      return interaction.reply('Please provide a valid YouTube video URL.');
    }

    // Acknowledge the interaction to prevent timeout
    await interaction.deferReply();

    downloadYTLiveChats(URL, async err => {
      if (err) {
        console.error('An error occurred during processing:', err);
        return interaction.editReply('An error occurred while processing the file.');
      }

      fs.readFile('chatFormatted.txt', 'utf8', (err, formattedText) => {
        if (err) {
          console.error('Error reading formatted chat file:', err);
          return interaction.editReply('An error occurred while reading the final file.');
        }

        const messages = splitMessage(formattedText);
        messages.forEach((message, index) => {
          interaction.followUp(message)
            .catch(error => {
              console.error('Error sending message:', error);
              interaction.followUp('An error occurred while sending the reply.');
            });
        });
      });
    });
  },
};