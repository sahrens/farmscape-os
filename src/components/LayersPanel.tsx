import { useState, useRef } from 'react';
import { useStore } from '@/lib/store';
import type { ImageLayer } from '@/lib/api';
import farmConfig from '@/farm.config';
import { localToGps } from '@/lib/geo';

/**
 * LayersPanel — floating panel for managing image overlay layers.
 * Admin-only. Upload images, adjust opacity, toggle visibility, reposition/scale.
 */
export function LayersPanel({ onClose }: { onClose: () => void }) {
  const imageLayers = useStore(s => s.imageLayers);
  const createImageLayer = useStore(s => s.createImageLayer);
  const updateImageLayer = useStore(s => s.updateImageLayer);
  const deleteImageLayer = useStore(s => s.deleteImageLayer);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Convert to base64 data URL
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Get image dimensions for aspect ratio
      const img = new Image();
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.src = dataUrl;
      });

      // Default to 200 farm units wide, maintain aspect ratio
      const defaultWidth = 200;
      const aspect = dims.h / dims.w;
      const defaultHeight = defaultWidth * aspect;

      const name = file.name.replace(/\.[^.]+$/, '');
      await createImageLayer({
        name,
        url: dataUrl,
        x: 100, // center of typical farm
        y: 100,
        width: defaultWidth,
        height: defaultHeight,
        opacity: 0.5,
        visible: 1,
        sort_order: imageLayers.length,
      });
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload image layer');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleOpacityChange = (layer: ImageLayer, opacity: number) => {
    updateImageLayer(layer.id, { opacity });
  };

  const handleToggleVisibility = (layer: ImageLayer) => {
    updateImageLayer(layer.id, { visible: layer.visible ? 0 : 1 });
  };

  const handleDelete = async (layer: ImageLayer) => {
    if (!confirm(`Delete layer "${layer.name}"?`)) return;
    await deleteImageLayer(layer.id);
  };

  const editingLayer = editingId ? imageLayers.find(l => l.id === editingId) : null;

  /**
   * Fetch satellite tiles for the farm extent, stitch on canvas, save as image layer.
   * Uses ESRI World Imagery (free for visualization) or Google satellite tiles.
   */
  const handleAddSatellite = async () => {
    setUploading(true);
    try {
      const ref = farmConfig.geoReference;
      if (!ref) throw new Error('No geoReference configured');

      // Compute GPS bounding box from farm boundary
      const boundary = farmConfig.boundary;
      const gpsPoints = boundary.map(p => localToGps(p.x, p.y, ref.origin, ref.bearing, ref.metersPerUnit));
      const lats = gpsPoints.map(p => p.lat);
      const lngs = gpsPoints.map(p => p.lng);
      const minLat = Math.min(...lats) - 0.001; // small padding
      const maxLat = Math.max(...lats) + 0.001;
      const minLng = Math.min(...lngs) - 0.001;
      const maxLng = Math.max(...lngs) + 0.001;

      // Choose zoom level (18 = very detailed, 17 = good detail, 16 = wider)
      const zoom = 18;

      // Convert lat/lng to tile coordinates
      const lat2tile = (lat: number, z: number) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z));
      const lng2tile = (lng: number, z: number) => Math.floor((lng + 180) / 360 * Math.pow(2, z));

      const xMin = lng2tile(minLng, zoom);
      const xMax = lng2tile(maxLng, zoom);
      const yMin = lat2tile(maxLat, zoom); // note: y is inverted
      const yMax = lat2tile(minLat, zoom);

      const tilesX = xMax - xMin + 1;
      const tilesY = yMax - yMin + 1;
      const tileSize = 256;

      // Cap at reasonable size (max 6x6 = 36 tiles)
      if (tilesX * tilesY > 36) {
        throw new Error(`Too many tiles (${tilesX}x${tilesY}). Try a smaller area or lower zoom.`);
      }

      // Fetch tiles and draw on canvas
      const canvas = document.createElement('canvas');
      canvas.width = tilesX * tileSize;
      canvas.height = tilesY * tileSize;
      const ctx = canvas.getContext('2d')!;

      // Use ESRI World Imagery (free for visualization)
      const tileUrl = (x: number, y: number, z: number) =>
        `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

      const loadTile = (x: number, y: number): Promise<void> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.drawImage(img, (x - xMin) * tileSize, (y - yMin) * tileSize);
            resolve();
          };
          img.onerror = () => reject(new Error(`Failed to load tile ${x},${y}`));
          img.src = tileUrl(x, y, zoom);
        });
      };

      // Load all tiles in parallel
      const promises: Promise<void>[] = [];
      for (let y = yMin; y <= yMax; y++) {
        for (let x = xMin; x <= xMax; x++) {
          promises.push(loadTile(x, y));
        }
      }
      await Promise.all(promises);

      // Convert canvas to data URL (JPEG for smaller size)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      // Calculate farm-local position and size for the tile extent
      // Tile edges in GPS
      const tile2lng = (x: number, z: number) => x / Math.pow(2, z) * 360 - 180;
      const tile2lat = (y: number, z: number) => {
        const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
        return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
      };

      const tileLngMin = tile2lng(xMin, zoom);
      const tileLngMax = tile2lng(xMax + 1, zoom);
      const tileLatMax = tile2lat(yMin, zoom); // top of tile grid
      const tileLatMin = tile2lat(yMax + 1, zoom); // bottom of tile grid

      // Convert tile corners to local farm coords
      const { gpsToLocal } = await import('@/lib/geo');
      const sw = gpsToLocal(tileLatMin, tileLngMin, ref.origin, ref.bearing, ref.metersPerUnit);
      const ne = gpsToLocal(tileLatMax, tileLngMax, ref.origin, ref.bearing, ref.metersPerUnit);

      const width = Math.abs(ne.x - sw.x);
      const height = Math.abs(ne.y - sw.y);
      const centerX = (sw.x + ne.x) / 2;
      const centerY = (sw.y + ne.y) / 2;

      await createImageLayer({
        name: `Satellite (zoom ${zoom})`,
        url: dataUrl,
        x: centerX,
        y: centerY,
        width,
        height,
        opacity: 0.6,
        visible: 1,
        sort_order: 0, // below other layers
      });
    } catch (err) {
      console.error('Satellite fetch failed:', err);
      alert(`Failed to fetch satellite imagery: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="absolute top-14 right-4 z-30 w-72 bg-earth-900/95 backdrop-blur border border-earth-700 rounded-xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-earth-700">
        <h3 className="text-sm font-semibold text-earth-100">Image Layers</h3>
        <button
          onClick={onClose}
          className="text-earth-400 hover:text-earth-200 text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Layer list */}
      <div className="max-h-80 overflow-y-auto">
        {imageLayers.length === 0 ? (
          <div className="px-4 py-6 text-center text-earth-500 text-sm">
            No image layers yet. Upload a satellite image, parcel map, or other overlay.
          </div>
        ) : (
          <div className="divide-y divide-earth-800">
            {imageLayers.map(layer => (
              <div key={layer.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  {/* Visibility toggle */}
                  <button
                    onClick={() => handleToggleVisibility(layer)}
                    className={`w-5 h-5 flex items-center justify-center rounded text-xs ${
                      layer.visible
                        ? 'bg-forest-600 text-white'
                        : 'bg-earth-700 text-earth-500'
                    }`}
                    title={layer.visible ? 'Hide layer' : 'Show layer'}
                  >
                    {layer.visible ? '👁' : '—'}
                  </button>
                  {/* Name */}
                  <span className="text-sm text-earth-200 flex-1 truncate">
                    {layer.name}
                  </span>
                  {/* Edit button */}
                  <button
                    onClick={() => setEditingId(editingId === layer.id ? null : layer.id)}
                    className="text-xs text-earth-400 hover:text-earth-200 px-1"
                    title="Edit position/size"
                  >
                    ⚙
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(layer)}
                    className="text-xs text-red-400 hover:text-red-300 px-1"
                    title="Delete layer"
                  >
                    ✕
                  </button>
                </div>

                {/* Opacity slider */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-earth-500 w-12">Opacity</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={layer.opacity}
                    onChange={(e) => handleOpacityChange(layer, parseFloat(e.target.value))}
                    className="flex-1 h-1.5 accent-forest-500"
                  />
                  <span className="text-xs text-earth-400 w-8 text-right">
                    {Math.round(layer.opacity * 100)}%
                  </span>
                </div>

                {/* Expanded edit controls */}
                {editingId === layer.id && editingLayer && (
                  <LayerEditControls layer={editingLayer} onUpdate={updateImageLayer} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload button */}
      <div className="px-4 py-3 border-t border-earth-700 space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full px-3 py-2 bg-forest-700 hover:bg-forest-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : '+ Upload Image Layer'}
        </button>
        <button
          onClick={() => handleAddSatellite()}
          disabled={uploading}
          className="w-full px-3 py-2 bg-blue-800 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {uploading ? 'Fetching...' : '🛰 Add Satellite Imagery'}
        </button>
      </div>
    </div>
  );
}

/** Inline edit controls for position, size, rotation */
function LayerEditControls({
  layer,
  onUpdate,
}: {
  layer: ImageLayer;
  onUpdate: (id: string, updates: Partial<ImageLayer>) => Promise<boolean>;
}) {
  const [x, setX] = useState(String(layer.x));
  const [y, setY] = useState(String(layer.y));
  const [width, setWidth] = useState(String(layer.width));
  const [height, setHeight] = useState(String(layer.height));
  const [rotation, setRotation] = useState(String(layer.rotation));

  const save = () => {
    onUpdate(layer.id, {
      x: parseFloat(x) || 0,
      y: parseFloat(y) || 0,
      width: parseFloat(width) || 100,
      height: parseFloat(height) || 100,
      rotation: parseFloat(rotation) || 0,
    });
  };

  return (
    <div className="mt-2 space-y-2 pt-2 border-t border-earth-800">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-earth-500">
          X
          <input
            type="number"
            value={x}
            onChange={e => setX(e.target.value)}
            onBlur={save}
            className="mt-0.5 w-full px-2 py-1 bg-earth-800 border border-earth-700 rounded text-xs text-earth-200"
          />
        </label>
        <label className="text-xs text-earth-500">
          Y
          <input
            type="number"
            value={y}
            onChange={e => setY(e.target.value)}
            onBlur={save}
            className="mt-0.5 w-full px-2 py-1 bg-earth-800 border border-earth-700 rounded text-xs text-earth-200"
          />
        </label>
        <label className="text-xs text-earth-500">
          Width
          <input
            type="number"
            value={width}
            onChange={e => setWidth(e.target.value)}
            onBlur={save}
            className="mt-0.5 w-full px-2 py-1 bg-earth-800 border border-earth-700 rounded text-xs text-earth-200"
          />
        </label>
        <label className="text-xs text-earth-500">
          Height
          <input
            type="number"
            value={height}
            onChange={e => setHeight(e.target.value)}
            onBlur={save}
            className="mt-0.5 w-full px-2 py-1 bg-earth-800 border border-earth-700 rounded text-xs text-earth-200"
          />
        </label>
      </div>
      <label className="text-xs text-earth-500 block">
        Rotation (°)
        <input
          type="number"
          value={rotation}
          onChange={e => setRotation(e.target.value)}
          onBlur={save}
          className="mt-0.5 w-full px-2 py-1 bg-earth-800 border border-earth-700 rounded text-xs text-earth-200"
        />
      </label>
    </div>
  );
}
