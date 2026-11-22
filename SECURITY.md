# Security

## Supported versions

Fixes go into the latest 0.x release only. Until 1.0.0 there are no backports to earlier minor versions; update
to the latest one to get a fix.

## Reporting a vulnerability

Report it privately through a GitHub security advisory on the public repository:
<https://github.com/m-grgic/payload-plugin-widgets/security/advisories/new>.

Do not open a public issue or pull request for it. Say which version you found it in, how to reproduce it (a
config snippet and the request or page that shows it), and what someone could do with it.

You will get a reply on the advisory. Once a fix is released, the advisory is published with it, and you are
credited unless you ask not to be.

## In scope

The plugin reads collections on behalf of whoever is looking at the dashboard. Every read is meant to be made as
the signed-in user, with Payload's access control applied, and `access` on a source or widget only ever narrows
that. So these count as vulnerabilities:

- An access-control bypass in a widget read: a figure, list, chart or the widget drawer showing, counting or
  summing records, or revealing fields, that the signed-in user's access would not let them read, where the
  config does not ask for `overrideAccess`.
- A widget or source shown to, or readable by, someone its `access` excludes.
- Anything a dashboard user can put into a widget (its options, labels or filters) that runs as code or as markup
  in someone else's browser.

## Out of scope

- What a figure or chart configured with `overrideAccess: true` shows to the people its `access` lets in. That
  option reads with the server's access by design. Showing it to someone that `access` excludes is in scope.
- Dashboard layouts. Payload stores each person's layout as its own preference; report problems with that to
  Payload.
- Vulnerabilities in Payload, Next.js or React themselves. Report those to their projects.
- Anything that needs the attacker to already control the Payload config.
