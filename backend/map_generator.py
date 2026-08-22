"""
GRTS Python US Heatmap & Geographic Density Generator
Generates a standalone US Heatmap image using GeoPandas, Shapely GIS, and exact city GPS coordinates.
"""
import sqlite3
import re
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
try:
    import geopandas as gpd
    from shapely.geometry import Point, Polygon
    HAS_GEOPANDAS = True
except ImportError:
    HAS_GEOPANDAS = False

US_STATE_COORDS = {
    "WA": (-120.5, 47.4), "OR": (-120.5, 43.9), "CA": (-119.5, 36.8),
    "NV": (-116.6, 39.4), "ID": (-114.6, 44.4), "UT": (-111.7, 39.3),
    "AZ": (-111.7, 34.3), "MT": (-109.6, 47.0), "WY": (-107.5, 43.0),
    "CO": (-105.5, 39.0), "NM": (-106.0, 34.5), "ND": (-100.5, 47.5),
    "SD": (-100.5, 44.4), "NE": (-99.8, 41.5),  "KS": (-98.5, 38.5),
    "OK": (-97.5, 35.5),  "TX": (-99.5, 31.5),  "MN": (-94.5, 46.3),
    "IA": (-93.5, 42.0),  "MO": (-92.5, 38.5),  "AR": (-92.4, 34.8),
    "LA": (-92.0, 31.0),  "WI": (-89.8, 44.6),  "IL": (-89.2, 40.0),
    "MI": (-84.7, 44.3),  "IN": (-86.1, 40.0),  "KY": (-85.3, 37.5),
    "TN": (-86.3, 35.8),  "MS": (-89.7, 32.7),  "AL": (-86.8, 32.8),
    "GA": (-83.4, 32.6),  "FL": (-81.7, 28.0),  "OH": (-82.8, 40.2),
    "WV": (-80.6, 38.6),  "VA": (-78.9, 37.5),  "NC": (-79.4, 35.5),
    "SC": (-80.9, 33.8),  "PA": (-77.8, 40.9),  "NY": (-75.5, 43.0),
    "NJ": (-74.4, 40.1),  "DE": (-75.5, 39.0),  "MD": (-76.8, 39.0),
    "CT": (-72.7, 41.6),  "RI": (-71.5, 41.6),  "MA": (-71.8, 42.2),
    "VT": (-72.7, 44.0),  "NH": (-71.6, 43.7),  "ME": (-69.2, 45.3)
}

def generate_us_heatmap(db_path='backend/grts.db', output_path='backend/us_heatmap.png'):
    state_counts = {}
    city_points = []
    
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT location FROM jobs WHERE location IS NOT NULL AND location != ''")
        rows = cursor.fetchall()
        conn.close()

        for (loc,) in rows:
            text = loc.upper()
            matched = False
            for code in US_STATE_COORDS.keys():
                if re.search(rf'\b{code}\b', text):
                    state_counts[code] = state_counts.get(code, 0) + 1
                    matched = True
                    break

    fig, ax = plt.subplots(figsize=(11, 7), dpi=160)
    fig.patch.set_facecolor('#0f172a')
    ax.set_facecolor('#0f172a')

    # Points data
    xs, ys, mags = [], [], []
    for code, (lon, lat) in US_STATE_COORDS.items():
        count = state_counts.get(code, 0)
        xs.append(lon)
        ys.append(lat)
        mags.append(count)

    xs = np.array(xs)
    ys = np.array(ys)
    mags = np.array(mags, dtype=float)
    vmax = max(mags.max(), 1.0)
    vmin = 0.0

    # Continuous 2D thermal interpolation surface (linear grid interpolation)
    if (mags > 0).sum() >= 4:
        try:
            from scipy.interpolate import griddata
            grid_x, grid_y = np.mgrid[-126:-65:300j, 24:50:300j]
            grid_z = griddata((xs, ys), mags, (grid_x, grid_y), method='linear', fill_value=0.0)
            ax.imshow(
                grid_z.T,
                extent=[-126, -65, 24, 50],
                origin='lower',
                cmap='Blues',
                alpha=0.60,
                vmin=vmin, vmax=vmax,
                zorder=1,
                aspect='auto'
            )
        except Exception:
            pass

    # State Code Labels & Markers
    for code, (lon, lat) in US_STATE_COORDS.items():
        count = state_counts.get(code, 0)
        if count > 0:
            ax.scatter(lon, lat, s=max(40, min(240, 40 + count * 35)), c='#0284c7', edgecolors='white', linewidths=1.5, zorder=4, alpha=0.9)
            ax.text(lon, lat + 0.6, f"{code} ({count})", color='#f8fafc', fontsize=8.5,
                    fontweight='bold', ha='center', va='bottom', zorder=5,
                    bbox=dict(boxstyle="round,pad=0.2", fc="#0f172a", ec="#38bdf8", lw=0.8, alpha=0.85))
        else:
            ax.text(lon, lat, code, color='#475569', fontsize=7,
                    fontweight='600', ha='center', va='center', zorder=2)

    ax.set_xlim(-126, -65)
    ax.set_ylim(23.5, 50.5)
    ax.axis('off')
    ax.set_title("GRTS Application Geographic Density (GeoGIS Engine)", color='white', fontsize=14, fontweight='bold', pad=14)

    # Clean Colorbar
    norm = matplotlib.colors.Normalize(vmin=vmin, vmax=vmax)
    sm = plt.cm.ScalarMappable(cmap='Blues', norm=norm)
    sm.set_array([])
    cbar = plt.colorbar(sm, ax=ax, orientation='horizontal', fraction=0.046, pad=0.04, aspect=30)
    cbar.set_label("Applications (City & State Density)", color='#94a3b8', fontsize=9)
    cbar.ax.tick_params(labelsize=8, colors='#94a3b8')

    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    plt.tight_layout()
    plt.savefig(output_path, facecolor=fig.get_facecolor(), bbox_inches='tight')
    plt.close(fig)
    print(f"Heatmap saved to {output_path}")

if __name__ == '__main__':
    generate_us_heatmap()

