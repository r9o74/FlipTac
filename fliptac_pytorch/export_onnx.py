import torch
from model import DQN  # model.py からDQNクラスをインポート

# --- 設定 ---
# 1. 盤面サイズを5x5に変更
BOARD_SIZE = 5

# 2. 読み込む学習済みモデルのファイル名を指定
PATH_TO_PTH_FILE = "fliptac_dqn_5x5_final.pth"

# 3. 出力するONNXモデルのファイル名を指定
OUTPUT_ONNX_FILE = "fliptac_model_5x5.onnx"

# --- 実行 ---
if __name__ == '__main__':
    # モデルのインスタンスを作成
    device = torch.device("cpu")
    model = DQN(BOARD_SIZE, BOARD_SIZE).to(device)

    # 学習済みチェックポイントを読み込む
    checkpoint = torch.load(PATH_TO_PTH_FILE, map_location=device)

    # ▼▼▼ ここが重要な修正箇所です ▼▼▼
    # 新しい形式のチェックポイント（辞書）から、モデルの重みデータを取り出す
    model.load_state_dict(checkpoint['policy_net_state_dict'])
    # ▲▲▲ 修正ここまで ▲▲▲
    
    model.eval() # 推論モードに設定

    # ONNXエクスポートのためのダミー入力データを作成 (サイズを5x5に変更)
    dummy_input = torch.randn(1, 3, BOARD_SIZE, BOARD_SIZE, device=device)

    # ONNX形式にエクスポート
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

