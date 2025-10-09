import torch
from model import DQN  # model.py からDQNクラスをインポート

# --- 設定 ---
BOARD_SIZE = 7
PATH_TO_PTH_FILE = "fliptac_dqn_final.pth"  # あなたの学習済みモデルのパス
OUTPUT_ONNX_FILE = "fliptac_model.onnx"

# --- 実行 ---
if __name__ == '__main__':
    # 1. モデルのインスタンスを作成
    device = torch.device("cpu")
    model = DQN(BOARD_SIZE, BOARD_SIZE).to(device)

    # 2. 学習済みチェックポイントを読み込む
    checkpoint = torch.load(PATH_TO_PTH_FILE, map_location=device)

    # ▼▼▼ ここからが修正箇所 ▼▼▼
    # 新しい形式のチェックポイントから、モデルの重みデータを取り出す
    # 'policy_net_state_dict' というキーを指定する
    model.load_state_dict(checkpoint['policy_net_state_dict'])
    # ▲▲▲ 修正ここまで ▲▲▲
    
    model.eval() # 推論モードに設定

    # 3. ONNXエクスポートのためのダミー入力データを作成
    dummy_input = torch.randn(1, 3, BOARD_SIZE, BOARD_SIZE, device=device)

    # 4. ONNX形式にエクスポート
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

