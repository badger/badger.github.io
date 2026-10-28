export const universePrompt = 'What did we announce at GitHub Universe this year?'

export const universeResponse = `The modern GitHub experience

- Attach Flag: upload screenshots straight from the terminal into issues, pull requests and comments.
- Stacked PRs: split a large change into smaller pull requests that build on each other, so each is easier to review.
- Maintainer controls: tools for maintainers to manage the extra PRs agents create.

What's new in GitHub Copilot

- Skills: teach Copilot a repeatable job.
- Tools (/agentfinder): find agents and plugins for a task.
- Security review (/security-review): check an agent's changes for security issues.
- Automations (/factory-creator): run a skill on a trigger, such as when an issue opens.

Bringing it all together

- Issue Artifacts: add files and other agent generated context to an issue`

export function initDoomCopilotTerminal(root: HTMLElement, signal: AbortSignal, onOpen: () => void, onClose: () => void) {
  const dialog = root.querySelector<HTMLElement>('[data-doom-terminal]')
  if (!dialog) return { open() {}, close() {} }
  const prompt = dialog.querySelector<HTMLElement>('[data-terminal-prompt]')!
  const output = dialog.querySelector<HTMLElement>('[data-terminal-output]')!
  const status = dialog.querySelector<HTMLElement>('[data-terminal-status]')!
  const caret = dialog.querySelector<HTMLElement>('[data-terminal-caret]')!
  const transcript = dialog.querySelector<HTMLElement>('[data-terminal-transcript]')!
  const scroll = dialog.querySelector<HTMLElement>('[data-terminal-scroll]')!
  const hint = dialog.querySelector<HTMLElement>('[data-terminal-hint]')!
  let timer: ReturnType<typeof setTimeout> | undefined
  let active = false

  const stop = () => {
    clearTimeout(timer)
    if (!active) return
    active = false
    dialog.hidden = true
    onClose()
  }
  const later = (callback: () => void, delay: number) => { timer = setTimeout(callback, delay) }
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault()
      stop()
    }
  }, { signal })
  // Do not forward terminal navigation to the game runtime.
  for (const type of ['keydown', 'keypress', 'keyup']) {
    dialog.addEventListener(type, event => event.stopPropagation(), { signal })
  }
  signal.addEventListener('abort', () => {
    clearTimeout(timer)
    active = false
    dialog.hidden = true
  }, { once: true })

  return {
    close: stop,
    open() {
      if (active || signal.aborted) return
      clearTimeout(timer)
      dialog.hidden = false
      active = true
      onOpen()
      dialog.focus({ preventScroll: true })
      scroll.scrollTop = 0
      prompt.textContent = ''
      output.textContent = ''
      transcript.textContent = ''
      transcript.hidden = true
      hint.hidden = true
      status.textContent = 'Typing prompt'
      caret.hidden = false
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      let typed = 0
      let streamed = 0
      const finish = () => {
        status.textContent = 'Response complete'
        transcript.textContent = `${universePrompt}\n\n${universeResponse}`
        transcript.hidden = false
        dialog.dataset.state = 'complete'
        hint.hidden = false
        scroll.scrollTop = scroll.scrollHeight
      }
      const stream = () => {
        const chunk = universeResponse.slice(streamed, streamed + 12 + Math.floor(Math.random() * 17))
        streamed += chunk.length
        output.textContent = universeResponse.slice(0, streamed)
        scroll.scrollTop = scroll.scrollHeight
        if (streamed === universeResponse.length) finish()
        else later(stream, 60 + Math.random() * 65 + (chunk.includes('\n') ? 150 : /[.!?]\s*$/.test(chunk) ? 90 : 0))
      }
      const think = () => {
        caret.hidden = true
        status.textContent = 'Thinking...'
        dialog.dataset.state = 'thinking'
        later(() => {
          status.textContent = 'Generating response'
          dialog.dataset.state = 'streaming'
          if (reducedMotion) {
            output.textContent = universeResponse
            scroll.scrollTop = scroll.scrollHeight
            finish()
          } else stream()
        }, 2000)
      }
      const type = () => {
        prompt.textContent = universePrompt.slice(0, ++typed)
        if (typed === universePrompt.length) think()
        else {
          const wordPause = universePrompt[typed - 1] === ' ' ? 90 + Math.random() * 140 : 0
          const hesitation = Math.random() < 0.12 ? 150 + Math.random() * 200 : 0
          later(type, 30 + Math.random() * 85 + wordPause + hesitation)
        }
      }
      dialog.dataset.state = 'typing'
      if (reducedMotion) {
        prompt.textContent = universePrompt
        think()
      } else later(type, 250)
    },
  }
}
