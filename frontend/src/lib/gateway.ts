/** Sends the browser to the CMI payment page with the signed form prepared by the server. */
export function postToGateway(gateway: { url: string; fields: Record<string, string> }) {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = gateway.url
  form.acceptCharset = 'UTF-8'
  for (const [name, value] of Object.entries(gateway.fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
}
