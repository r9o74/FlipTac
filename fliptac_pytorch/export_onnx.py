import torch
from model import DQN  # model.py からDQNクラスをインポート

# --- 設定 ---
BOARD_SIZE = 7
PATH_TO_PTH_FILE = "fliptac_dqn_final.pth"  # あなたの学習済みモデルのパス
OUTPUT_ONNX_FILE = "fliptac_model.onnx"

# --- 実行 ---
if __name__ == '__main__':
    # 1. モデルのインスタンスを作成し、学習済み权重を読み込む
    device = torch.device("cpu")
    model = DQN(BOARD_SIZE, BOARD_SIZE).to(device)
    model.load_state_dict(torch.load(PATH_TO_PTH_FILE, map_location=device))
    model.eval() # 推論モードに設定

    # 2. ONNXエクスポートのためのダミー入力データを作成
    # モデルの入力形式 (batch_size, channels, height, width) に合わせる
    dummy_input = torch.randn(1, 3, BOARD_SIZE, BOARD_SIZE, device=device)

    # 3. ONNX形式にエクスポート
    torch.onnx.export(model,
                      dummy_input,
                      OUTPUT_ONNX_FILE,
                      export_params=True,
                      opset_version=11,
                      do_constant_folding=True,
                      input_names=['input'],
                      output_names=['output'],
                      dynamic_axes={'input': {0: 'batch_size'},
                                    'output': {0: 'batch_size'}})

    print(f"モデルが '{OUTPUT_ONNX_FILE}' として正常にエクスポートされました。")
