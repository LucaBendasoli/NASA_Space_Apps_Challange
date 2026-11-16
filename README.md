# Eyelid

**Explore the infrared sky and find observations worth a second look.**

2026 NASA Space Apps Challenge · Planet X and SPHEREx

## [Launch the judges’ demo](https://nasaspaceapps.eyelid.com.br/jurados)

The judges’ link opens the demo directly. **No email, password, or setup required.**

[Regular sign-in and account creation](https://nasaspaceapps.eyelid.com.br/)

## What Eyelid does

Eyelid turns real SPHEREx observations into an interactive sky map. It brings images, spectra, and catalog matches into one view so anyone can compare observations and see why a source might deserve closer inspection.

The map brings together **SPHEREx** infrared observations, **WISE** imagery, and **Gaia DR3** catalog positions. Eyelid flags infrared detections for review, using Gaia matches and filters for bright-source halos to reduce false positives. A candidate is a lead to investigate. It may be a known infrared source, an artifact, or a source without a Gaia match.

## Try it in two minutes

1. **Follow a moving star.** On Home, open **Barnard’s Star** from Suggested observations or Saved regions. In the map, open the date controls and press **Play** to compare exposures in the same channel.
2. **Inspect the evidence.** Open **Epsilon Indi B** from Saved regions and select an investigation marker. The object panel shows which infrared bands recorded a signal and why the detection was flagged. Select a Gaia source to see its catalog details and any available spectrum.
3. **See how a review is shared.** Return to **Home → Community**, open a discussion, and choose **Open view on map** to revisit the coordinates, channel, and date shared with that post.

The judges’ demo includes five prepared fields: **Barnard’s Star**, **Epsilon Indi B**, **WISE 0855**, **RW Aurigae**, and **R Draconis**. The sky observations are real. The community includes sample discussions, replies, and votes created for the demonstration. Available dates and channels vary with coverage.

## Project code

The submitted app lives in [`eyelid/`](eyelid/). It uses Aladin Lite for sky navigation and a Python backend for FITS processing, catalog queries, and candidate review. See the [local setup and data notes](eyelid/README.md).
