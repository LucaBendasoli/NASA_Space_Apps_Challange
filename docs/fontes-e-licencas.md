# Sources, project identity, and licenses

## Provenance

| Primary source | Use and evidence |
| --- | --- |
| [Requested page](https://aladin.cds.unistra.fr/AladinLite/) | Exact URL supplied for the investigation. Text extraction identified catalog, VizieR, and local-file controls |
| [CDS portal and notice](https://aladin.cds.unistra.fr/) | Notice updated on November 9, 2026, identifying the contingency previewer and listing mirrors |
| [Official repository](https://github.com/cds-astro/aladin-lite) | The README links to the requested page, and the documentation links back to the repository |
| [Imported commit](https://github.com/cds-astro/aladin-lite/tree/60c5cf414d6d56a10b406761e62e8c2ce9f2a760) | Pinned source snapshot inspected and copied |
| [Original package.json](https://github.com/cds-astro/aladin-lite/blob/60c5cf414d6d56a10b406761e62e8c2ce9f2a760/package.json) | Package name aladin-lite, version 3.9.0-beta, authors, repository, and license |
| [Official API](https://cds-astro.github.io/aladin-lite/Aladin.html) | Camera, coordinates, layers, and events |
| [API entry point](https://cds-astro.github.io/aladin-lite/A.html) | Initialization, catalogs, and sources |
| [IVOA HiPS standard](https://www.ivoa.net/documents/HiPS/) | Normative reference identified by the project. The investigation did not audit the entire standard |

The CDS notice links to [aladin_3.9.0-beta.js](https://aladin.cds.unistra.fr/aladin_3.9.0-beta.js), the first remote source for the demonstration. The second follows the versioned URL convention in the README. Pinning the version avoids silent updates through `latest`.

Official project links and the declared version establish the identity of the imported Aladin Lite source. The session did not confirm that the current public page wrapper is in the repository or that the hosted bundle matches the commit byte for byte. The bundle download was unsuccessful in that session.

## Snapshot contents

`upstream/aladin-lite/` contains 429 unmodified files retrieved through the GitHub connector at the pinned commit. It includes all blobs in `src/`, `assets/`, `scripts/`, and `tutorials/`, plus root files such as `LICENSE`, `COPYING`, and `AUTHORS`. Examples, tests, and workflows were excluded. This selected snapshot has no Git history or `.git` directory.

`upstream/files.json` records paths, Git blob hashes, and sizes. `npm.cmd run verify:upstream` recalculates `SHA1("blob " + size + NUL + bytes)` and compares against the GitHub blob hashes. This verifies byte-for-byte integrity against the fetched source. Author signatures are outside that check.

## Library license

The package manifest and source headers declare **LGPL-3.0-or-later**. `LICENSE` contains LGPLv3 and `COPYING` contains the GPLv3 incorporated by the LGPL. Historical documentation mentions GPLv3, so the license was checked against the files in the imported commit.

Copyright and license notices were preserved, including notices from individual third-party components. The interface retains the library logo and link and displays CDS attribution. The logo stays visible in CSS.

The official engine retains its original code and name. When redistributing a bundle or modified library, retain licensing and attribution, provide access to the corresponding source, and meet the applicable distribution conditions. The license files specify the obligations for each distribution.

## Project code and data

`index.html`, `src/`, `scripts/`, `tests/`, `docs/`, and `iniciar.cmd` were written for this demonstration. It uses the CDS engine through its public API.

The eight objects are an educational list of approximate positions for known targets, available when navigating without a remote query. The list was assembled independently of CDS catalog exports. HiPS images remain with their providers. Each survey's `properties` file, linked in the interface, contains its credits, references, and data terms.
