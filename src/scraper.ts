import { launch } from 'puppeteer'
import { argv } from 'process'
const r2 = require('r2')

// normalizes shop names
const serialize = (name: string): string => {
  let result = name.toLowerCase()
  const cities = [
    'campbell',
    'cupertino',
    'fremont',
    'los gatos',
    'mountain view',
    'palo alto',
    'san jose',
    'san mateo',
    'santa clara',
    'saratoga',
    'sunnyvale',
  ]
  for (const city of cities) {
    result = result.replace(city, '')
  }
  return result.replace(/[^a-z0-9 ]/gi, '').replace(/ +/g, ' ').trim()
}

// gets url for api calls
const getList = async (page = 1) => {
  const tld = ['m', 'o', 'c', '.', 's', 'p', 'a', 'm', 'd', 'e', 'e', 'w', '.', 'g', '-', 'i', 'p', 'a']
  const base = `https://${tld.reverse().join('')}/discovery/v1/listings`
  const params = [
    'filter%5Bany_retailer_services%5D%5B%5D=storefront',
    'filter%5Bany_retailer_services%5D%5B%5D=delivery',
    'filter%5Bbounding_box%5D=37.21373721393525%2C-122.48854905366899%2C37.51770840492278%2C-121.609642803669',
    'page_size=100',
    `page=${page}`,
    'sort_by=name',
    'sort_order=asc',
  ]
  const url = `${base}?${params.join('&')}`
  const res = await r2(url).response
  const { listings } = (await res.json()).data
  return listings
}

(async () => {
  // create new browser
  const browser = await launch()
  const page = await browser.newPage()

  // get list of all shops
  const shops: { [key: string]: string } = {}
  const results = []
  let temp: Array<any>
  let i = 1
  while (!temp || temp.length > 0) {
    temp = await getList(i++)
    results.push(
      ...temp
      .map(item => ({ name: serialize(item.name), url: item.web_url }))
      .filter(item => {
        if (!shops[item.name]) {
          shops[item.name] = item.url
          return true
        }
        return false
      })
    )
  }

  // get list of filtered urls
  const maxPrice = parseFloat(argv[2]) || null
  for (const shop of results) {
    const url = shop.url + '?' + [
      'filter%5BcategoryNames%5D%5B%5D=wax',
      'sortBy=min_price',
      'sortOrder=asc'
    ].join('&')
    await page.goto(url, { waitUntil: 'load' })

    // check for 'are you old enough' modal
    const oldEnoughButton = await page.$('.fGomjA')
    if (oldEnoughButton) {
      await oldEnoughButton.click()
    }

    // check for no results
    const noItemsLabel = await page.$('.styled-components__NoItems-sc-45yec-26.jrcHaL')
    if (!noItemsLabel) {
      // check for overpriced items
      const lowestPrice = await page.$eval('.jLflXl', (price) => (price as HTMLElement).innerText)
      const lowestPriceAmount = parseFloat(lowestPrice.substr(1))
      if (maxPrice === null || (maxPrice !== null && lowestPriceAmount <= maxPrice)) {
        // add shop url to approved list
        console.log(url)
      } else {
        // console.log('NOT ALLOWED', lowestPrice, lowestPriceAmount, url)
      }
    } else {
      // console.log('NOT ALLOWED (no items)', url)
    }
  }

  // close browser
  await browser.close()
})()
