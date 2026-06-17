import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';

export function exportOBJ(group) {
  const exporter = new OBJExporter();
  const result = exporter.parse(group);
  const blob = new Blob([result], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mooring-system.obj';
  a.click();
  URL.revokeObjectURL(url);
}
