from rembg import remove
from PIL import Image
import sys

def main():
    if len(sys.argv) < 2:
        print("Uso: python remove-bg.py <caminho_imagem>")
        sys.exit(1)
        
    img_path = sys.argv[1]
    print(f"Lendo imagem: {img_path}")
    
    input_image = Image.open(img_path)
    output_image = remove(input_image)
    
    # Garantir que a saída seja salva como PNG para suportar RGBA
    import os
    base_name = os.path.splitext(img_path)[0]
    out_path = base_name + ".png"
    output_image.save(out_path)
    
    if img_path != out_path:
        os.remove(img_path) # apaga o arquivo original se não for png
        
    print(f"Fundo removido com sucesso: {out_path}")
    
    print(f"Fundo removido com sucesso: {img_path}")

if __name__ == "__main__":
    main()
