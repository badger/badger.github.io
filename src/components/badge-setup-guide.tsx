export function BadgeSetupGuide() {
  return (
    <details className="rounded-lg border border-border/60 bg-background/45">
      <summary className="cursor-pointer rounded-lg px-4 py-3 font-mono text-sm uppercase tracking-[0.12em] text-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset">
        Instructions
      </summary>

      <div className="space-y-6 border-t border-border/50 px-4 py-4 text-sm leading-6 text-muted-foreground sm:px-5">
        <section>
          <h3 className="font-mono text-xs uppercase tracking-[0.14em] text-foreground">Connect the badge</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 marker:text-primary">
            <li>Connect the badge to your laptop with a USB-C data cable.</li>
            <li>On the back of the badge, quickly press RESET twice. Wait for a message on the badge screen to confirm disk mode. You should see a drive called <code className="text-primary">BADGER</code> appear in your file manager.</li>
            <li>Select <strong className="font-medium text-foreground">Open BADGER disk</strong> here on the site. Choose the badge drive root itself, not the <code className="text-primary">apps</code> folder, then allow the browser to read and write its files.</li>
          </ol>
          <p className="mt-3">The page will show that the disk is connected and list the apps in the badge’s writable apps folder.</p>
          <p className="mt-2">If you see an <code className="text-primary">RP2350</code> drive, you entered firmware-flashing mode. Press RESET once to restart without flashing, then quickly press RESET twice to enter disk mode.</p>
        </section>

        <section>
          <h3 className="font-mono text-xs uppercase tracking-[0.14em] text-foreground">Install and manage apps</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-primary">
            <li>In Available apps, select <strong className="font-medium text-foreground">+</strong> to add an app or <strong className="font-medium text-foreground">−</strong> to remove an installed app. A checkmark means the change is queued.</li>
            <li>To use your own app, choose an app folder or drop it into Add local app.</li>
            <li>Select <strong className="font-medium text-foreground">Save</strong> beside Reload to apply all queued changes.</li>
          </ul>
        </section>

        <section>
          <h3 className="font-mono text-xs uppercase tracking-[0.14em] text-foreground">Finish safely</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 marker:text-primary">
            <li>Wait for Save to finish.</li>
            <li>Select <strong className="font-medium text-foreground">Eject</strong> on this site. Then use your operating system’s eject control (for example, Finder or File Explorer) before unplugging the cable.</li>
            <li>Press RESET once to restart the badge and return to its launcher.</li>
          </ol>
          <p className="mt-3">If the drive does not appear, check the USB-C data cable and press RESET twice again.</p>
        </section>
      </div>
    </details>
  )
}
