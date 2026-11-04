// Intercept only the page's configuration fetch. Puppeteer's global interception
// also enables Fetch on Worker targets, which newer Chrome does not support.
export async function failNextConfig(page, name, config) {
  const session = await page.createCDPSession();
  let used = false;
  session.on('Fetch.requestPaused', event => {
    if (!used && new URL(event.request.url).pathname.endsWith(`/${name}`)) {
      used = true;
      void session.send('Fetch.fulfillRequest', {
        requestId: event.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        body: Buffer.from(JSON.stringify(config)).toString('base64'),
      });
    } else void session.send('Fetch.continueRequest', { requestId: event.requestId });
  });
  await session.send('Fetch.enable', { patterns: [{ urlPattern: `*/${name}`, requestStage: 'Request' }] });
  return { used: () => used };
}
