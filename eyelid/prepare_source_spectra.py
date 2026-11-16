"""Generate the five saved-field spectra from the SPHEREx DR1 archive."""
import json
import math
from pathlib import Path
from tempfile import TemporaryDirectory

from source_spectrum import download_cube, measure_spectrum


def main():
    root = Path(__file__).resolve().parent
    targets = json.loads((root / 'poc-targets.json').read_text())
    results = {}
    with TemporaryDirectory(prefix='eyelid-poc-spectra-') as work:
        directory = Path(work)

        def cube_path(tile):
            path = directory / f'{tile}.fits'
            return path if path.exists() else download_cube(tile, directory)

        for target in targets:
            ra, dec, epoch, pmra, pmdec = target['reference']
            years = 2025.75 - epoch
            ra = (ra + years * pmra / (3.6e6 * math.cos(math.radians(dec)))) % 360
            dec += years * pmdec / 3.6e6
            results[target['key']] = measure_spectrum(round(ra, 5), round(dec, 5), cube_path)
    output = json.dumps(results, allow_nan=False, separators=(',', ':'))
    (root / 'dist' / 'poc-spectra.json').write_text(output + '\n')


if __name__ == '__main__':
    main()
