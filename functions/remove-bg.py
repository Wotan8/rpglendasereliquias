import os
import sys
import numpy as np
from PIL import Image
import cv2

def remove_background(img_path):
    print(f"Lendo imagem: {img_path}")
    pil_img = Image.open(img_path).convert("RGB")
    img_np = np.array(pil_img)
    
    # Verifica se os cantos são praticamente brancos (> 230)
    corners = [
        img_np[0, 0],
        img_np[0, -1],
        img_np[-1, 0],
        img_np[-1, -1]
    ]
    is_white_bg = all(np.mean(c) > 230 for c in corners)
    
    from rembg import remove
    
    # Process with rembg
    try:
        output_image = remove(pil_img, alpha_matting=True, alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=15)
    except Exception:
        output_image = remove(pil_img)
        
    # Extra fringe cleaning: ensure pure white background residue on borders is transparent
    rgba_np = np.array(output_image)
    if rgba_np.shape[2] == 4:
        rgb = rgba_np[:, :, :3]
        alpha = rgba_np[:, :, 3]
        
        # Color difference from pure white
        white_diff = np.max(np.abs(rgb.astype(np.int16) - 255), axis=2)
        
        # Smooth alpha near transparent edges where color is nearly pure white
        fringe_mask = (white_diff < 12) & (alpha < 240)
        alpha[fringe_mask] = 0
        
        rgba_np[:, :, 3] = alpha
        output_image = Image.fromarray(rgba_np)
    
    base_name = os.path.splitext(img_path)[0]
    out_path = base_name + ".png"
    output_image.save(out_path, optimize=True)
    
    if img_path != out_path and os.path.exists(img_path):
        os.remove(img_path)
        
    print(f"Fundo removido com perfeição: {out_path}")

def main():
    if len(sys.argv) < 2:
        print("Uso: python remove-bg.py <caminho_imagem>")
        sys.exit(1)
        
    remove_background(sys.argv[1])

if __name__ == "__main__":
    main()
