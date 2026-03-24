# -*- coding: utf-8 -*-
import re, io

with io.open('paper-synthesis.html', 'r', encoding='utf-8') as f:
    c = f.read()

# Find and replace the draw method + drawInnerFacets
old_draw_start = c.find(u'// \u7ed8\u52363D\u6c34\u6676\u788e\u7247')
old_draw_end = c.find(u'    }\n\n    // ===== \u661f\u5c18', old_draw_start)

new_draw = u'''// 绘制纸张碎片
        draw(ctx, offsetX, offsetY, globalGlow, time) {
            if (this.opacity < 0.01) return;
            ctx.save();
            ctx.globalAlpha = this.opacity;

            const px = offsetX + this.x;
            const py = offsetY + this.y;
            ctx.translate(px, py);
            ctx.scale(this.scale, this.scale);

            const cosRz = Math.cos(this.rz), sinRz = Math.sin(this.rz);
            const flatness = this.easeOutQuart(Math.max(0, Math.min(1, this.progress)));
            const flutterStr = (1 - flatness);
            const t = time || 0;

            // 纸张柔软弯曲变形
            const bendAmount = this.bendAmp * flutterStr * Math.sin(t * this.bendFreq + this.flutterPhase);

            // 变换顶点 - 纸张用2D旋转 + 弯曲
            const transformed = this.verts.map(v => {
                let x = v[0] - this.cx, y = v[1] - this.cy;
                // 旋转
                const x2 = x * cosRz - y * sinRz;
                const y2 = x * sinRz + y * cosRz;
                // 柔软弯曲 - 根据y坐标偏移x（模拟纸张弯曲）
                const bendOffset = bendAmount * Math.sin((y2 / 150) * Math.PI);
                return [x2 + bendOffset, y2];
            });

            // ===== 纸张阴影（飘动时有投影）=====
            if (flutterStr > 0.1) {
                ctx.shadowColor = 'rgba(0, 0, 0, ' + (0.25 * flutterStr) + ')';
                ctx.shadowBlur = 15 * flutterStr;
                ctx.shadowOffsetX = 5 * flutterStr;
                ctx.shadowOffsetY = 8 * flutterStr;
            }

            // ===== 绘制纸张正面 =====
            ctx.beginPath();
            transformed.forEach(function(v, i) {
                if (i === 0) ctx.moveTo(v[0], v[1]);
                else ctx.lineTo(v[0], v[1]);
            });
            ctx.closePath();

            ctx.save();
            ctx.clip();

            // 贴图
            if (imgLoaded) {
                ctx.drawImage(img, 0, 0, TARGET_W, TARGET_H, -this.cx, -this.cy, TARGET_W, TARGET_H);

                // 纸张泛黄叠加（随拼合消失）
                var paperAlpha = 0.12 * (1 - flatness);
                if (paperAlpha > 0.01) {
                    ctx.fillStyle = 'rgba(200, 180, 130, ' + paperAlpha + ')';
                    ctx.fillRect(-this.cx, -this.cy, TARGET_W, TARGET_H);
                }

                // 纸张纤维纹理 - 细密的斜线
                if (flutterStr > 0.05) {
                    ctx.globalAlpha = 0.04 * flutterStr;
                    var fiberGrad = ctx.createLinearGradient(
                        -this.cx, -this.cy,
                        -this.cx + Math.cos(this.fiberAngle) * TARGET_W,
                        -this.cy + Math.sin(this.fiberAngle) * TARGET_H
                    );
                    for (var fi = 0; fi < 20; fi++) {
                        var ft = fi / 20;
                        fiberGrad.addColorStop(ft, ft % 2 === 0 ? 'rgba(180,160,120,0.3)' : 'rgba(255,250,240,0.1)');
                    }
                    ctx.fillStyle = fiberGrad;
                    ctx.fillRect(-this.cx, -this.cy, TARGET_W, TARGET_H);
                    ctx.globalAlpha = this.opacity;
                }

                // 边缘暗化（撕裂处泛黄焦边）
                if (flutterStr > 0.05) {
                    var mx = 0, my = 0;
                    transformed.forEach(function(v) { mx += v[0]; my += v[1]; });
                    mx /= transformed.length; my /= transformed.length;
                    var edgeGrad = ctx.createRadialGradient(mx, my, 10, mx, my, 180);
                    edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
                    edgeGrad.addColorStop(0.7, 'rgba(0,0,0,0)');
                    edgeGrad.addColorStop(1, 'rgba(80, 50, 20, ' + (0.15 * flutterStr) + ')');
                    ctx.fillStyle = edgeGrad;
                    ctx.fillRect(-this.cx - 50, -this.cy - 50, TARGET_W + 100, TARGET_H + 100);
                }
            } else {
                ctx.fillStyle = 'rgba(240, 230, 210, 0.85)';
                ctx.fill();
            }

            ctx.restore();
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            // ===== 撕裂边缘线（毛边效果）=====
            var edgeStr = flutterStr * 0.6;
            if (edgeStr > 0.02) {
                ctx.beginPath();
                transformed.forEach(function(v, i) {
                    if (i === 0) ctx.moveTo(v[0], v[1]);
                    else ctx.lineTo(v[0], v[1]);
                });
                ctx.closePath();
                ctx.strokeStyle = 'rgba(180, 150, 100, ' + (edgeStr * 0.5) + ')';
                ctx.lineWidth = 1.2;
                ctx.stroke();

                // 撕裂处更亮的纤维丝
                ctx.strokeStyle = 'rgba(240, 230, 200, ' + (edgeStr * 0.3) + ')';
                ctx.lineWidth = 0.4;
                ctx.setLineDash([2, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // ===== 金色发光（飘动时微弱金光）=====
            var glowStr = this.glowIntensity * globalGlow * flutterStr;
            if (glowStr > 0.05) {
                ctx.shadowColor = 'rgba(255, 200, 100, ' + (0.4 * glowStr) + ')';
                ctx.shadowBlur = 20 * glowStr;
                ctx.beginPath();
                transformed.forEach(function(v, i) {
                    if (i === 0) ctx.moveTo(v[0], v[1]);
                    else ctx.lineTo(v[0], v[1]);
                });
                ctx.closePath();
                ctx.strokeStyle = 'rgba(255, 220, 150, ' + (0.2 * glowStr) + ')';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            ctx.restore();
        }

'''

if old_draw_start > 0 and old_draw_end > 0:
    c = c[:old_draw_start] + new_draw + c[old_draw_end:]
    with io.open('paper-synthesis.html', 'w', encoding='utf-8') as f:
        f.write(c)
    print('OK - replaced draw method')
else:
    print('NOT FOUND: start=%d, end=%d' % (old_draw_start, old_draw_end))
