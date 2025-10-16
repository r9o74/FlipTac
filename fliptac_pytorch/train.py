import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
import numpy as np
import random
import math
import os
import re
from collections import namedtuple, deque
from itertools import count
from tqdm import tqdm

# ローカルファイルからクラスをインポート
from FlipTacEnv import FlipTacEnv
from model import DQN

# ===============================================================
# 設定
# ===============================================================
BATCH_SIZE = 256 # バッチサイズを少し増やす
GAMMA = 0.99
# ▼▼▼ ε-greedyのパラメータを調整 ▼▼▼
EPS_START = 1.0  # 最初は完全にランダム
EPS_END = 0.01   # 最終的にはほぼ活用
EPS_DECAY = 100000 # より多くのエピソードをかけてゆっくり探索率を下げる
# ▲▲▲ ここまで ▲▲▲
TAU = 0.005
LR = 1e-4
BOARD_SIZE = 7
NUM_EPISODES = 200000 # 学習エピソード数を大幅に増やす
OPPONENT_POOL_SIZE = 10 # 対戦相手を保存するプールのサイズ
SAVE_INTERVAL = 1000 # モデルを保存する間隔

# ===============================================================
# Replay Memory
# ===============================================================
Transition = namedtuple('Transition', ('state', 'action', 'next_state', 'reward'))
class ReplayMemory(object):
    def __init__(self, capacity):
        self.memory = deque([], maxlen=capacity)
    def push(self, *args):
        self.memory.append(Transition(*args))
    def sample(self, batch_size):
        return random.sample(self.memory, batch_size)
    def __len__(self):
        return len(self.memory)

# ===============================================================
# 初期化 & チェックポイントからの再開
# ===============================================================
env = FlipTacEnv(size=BOARD_SIZE)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

policy_net = DQN(BOARD_SIZE, BOARD_SIZE).to(device)
target_net = DQN(BOARD_SIZE, BOARD_SIZE).to(device)
optimizer = optim.AdamW(policy_net.parameters(), lr=LR, amsgrad=True)
memory = ReplayMemory(10000)
steps_done = 0
start_episode = 0

checkpoint_dir = '.'
files = os.listdir(checkpoint_dir)
checkpoints = [f for f in files if f.startswith('fliptac_dqn_episode_') and f.endswith('.pth')]

if checkpoints:
    latest_episode = -1
    latest_checkpoint_file = None
    for ckpt in checkpoints:
        match = re.search(r'episode_(\d+)\.pth', ckpt)
        if match:
            episode_num = int(match.group(1))
            if episode_num > latest_episode:
                latest_episode, latest_checkpoint_file = episode_num, ckpt
    
    if latest_checkpoint_file:
        print(f"Resuming training from checkpoint: {latest_checkpoint_file}")
        
        # ▼▼▼ ここが重要な修正箇所です ▼▼▼
        try:
            # 新しい形式（辞書）での読み込みを試みる
            checkpoint = torch.load(latest_checkpoint_file)
            if isinstance(checkpoint, dict):
                policy_net.load_state_dict(checkpoint['policy_net_state_dict'])
                optimizer.load_state_dict(checkpoint.get('optimizer_state_dict', optimizer.state_dict()))
                steps_done = checkpoint.get('steps_done', 0)
            else:
                # 辞書でなければ古い形式と判断
                policy_net.load_state_dict(checkpoint)
                print("Warning: Loaded an old checkpoint format. Optimizer state and steps_done are not restored.")
        except Exception as e:
            # weights_only=False/True の問題を吸収するためのフォールバック
            print(f"Could not load checkpoint with default method due to {e}. Trying with weights_only=True.")
            checkpoint = torch.load(latest_checkpoint_file, weights_only=True)
            policy_net.load_state_dict(checkpoint)
            print("Warning: Loaded an old checkpoint format. Optimizer state and steps_done are not restored.")
        # ▲▲▲ 修正ここまで ▲▲▲
        
        start_episode = latest_episode
        print(f"Resumed from episode {start_episode}.")

target_net.load_state_dict(policy_net.state_dict())
target_net.eval()



# ▼▼▼ フェーズ2: 対戦相手プールの初期化 ▼▼▼
opponent_pool = []
opponent_dir = "opponent_pool"
if os.path.exists(opponent_dir):
    for f in os.listdir(opponent_dir):
        if f.endswith(".pth"):
            try:
                opponent_net = DQN(BOARD_SIZE, BOARD_SIZE).to(device)
                # ファイルを辞書形式として読み込みを試みる
                checkpoint = torch.load(os.path.join(opponent_dir, f))
                
                # 辞書形式か、重みデータそのものかを判別
                if isinstance(checkpoint, dict):
                    # 新しい辞書形式の場合
                    opponent_net.load_state_dict(checkpoint['policy_net_state_dict'])
                else:
                    # 古い形式の場合
                    opponent_net.load_state_dict(checkpoint)
                
                opponent_pool.append(opponent_net)
            except Exception as e:
                print(f"Warning: Could not load opponent model {f}. Error: {e}")

print(f"Loaded {len(opponent_pool)} opponents into the pool.")

# ▲▲▲ ここまで ▲▲▲




# ===============================================================
# 関数定義 (select_action, optimize_model)
# ===============================================================
def select_action(state):
    global steps_done
    sample = random.random()
    eps_threshold = EPS_END + (EPS_START - EPS_END) * math.exp(-1. * steps_done / EPS_DECAY)
    steps_done += 1
    if sample > eps_threshold:
        with torch.no_grad():
            q_values = policy_net(state)
            valid_moves = env.get_valid_moves(env.current_player)
            if not valid_moves: return None
            mask = torch.full((BOARD_SIZE * BOARD_SIZE,), -float('inf'), device=device)
            for r, c in valid_moves:
                mask[r * BOARD_SIZE + c] = 0.0
            action_q_values = q_values.view(-1) + mask
            action_idx = action_q_values.argmax().item()
            return (action_idx // BOARD_SIZE, action_idx % BOARD_SIZE)
    else:
        valid_moves = env.get_valid_moves(env.current_player)
        return random.choice(valid_moves) if valid_moves else None

def optimize_model():
    if len(memory) < BATCH_SIZE: return
    transitions = memory.sample(BATCH_SIZE)
    batch = Transition(*zip(*transitions))
    non_final_mask = torch.tensor(tuple(map(lambda s: s is not None, batch.next_state)), device=device, dtype=torch.bool)
    non_final_next_states = torch.cat([s for s in batch.next_state if s is not None])
    state_batch = torch.cat(batch.state)
    action_batch = torch.tensor([a[0] * BOARD_SIZE + a[1] for a in batch.action], device=device).unsqueeze(1)
    reward_batch = torch.cat(batch.reward)
    state_action_values = policy_net(state_batch).gather(1, action_batch)
    next_state_values = torch.zeros(BATCH_SIZE, device=device)
    with torch.no_grad():
        next_state_values[non_final_mask] = target_net(non_final_next_states).max(1)[0]
    expected_state_action_values = (next_state_values * GAMMA) + reward_batch
    criterion = nn.SmoothL1Loss()
    loss = criterion(state_action_values, expected_state_action_values.unsqueeze(1))
    optimizer.zero_grad()
    loss.backward()
    torch.nn.utils.clip_grad_value_(policy_net.parameters(), 100)
    optimizer.step()


# ===============================================================
# 学習ループ
# ===============================================================
if __name__ == '__main__':
    # tqdmを使って、学習の進捗をプログレスバーで表示します
    for i_episode in tqdm(range(start_episode, NUM_EPISODES), desc="Training Progress", initial=start_episode, total=NUM_EPISODES):
        
        # ▼▼▼ フェーズ2: 対戦相手をプールからランダムに選択 ▼▼▼
        # プールが空か、25%の確率で最新の自分自身と対戦します
        if not opponent_pool or random.random() < 0.25:
            opponent_net = target_net # 最新の自分（target_netはpolicy_netの安定版）
        else:
            opponent_net = random.choice(opponent_pool)
        opponent_net.eval() # 相手モデルを推論モードに設定
        # ▲▲▲ ここまで ▲▲▲
        
        # ゲーム環境をリセットして、最初の盤面状態を取得
        state = env.reset()
        state = torch.tensor(state, dtype=torch.float32, device=device).unsqueeze(0)
        
        # 1エピソード（1ゲーム）が終わるまでループ
        for t in count():
            # 現在のプレイヤーがAI(1)か相手(-1)かで使うモデルを切り替える
            if env.current_player == 1:
                # 自分のターン：学習中のpolicy_netを使って行動を選択
                action = select_action(state)
            else: # 相手のターン
                with torch.no_grad(): # 勾配計算は不要
                    # 相手もDQNモデルとして手を選択する
                    q_values = opponent_net(state)
                    valid_moves = env.get_valid_moves(env.current_player)
                    if not valid_moves:
                        action = None
                        break
                    
                    # 有効な手以外は選択しないようにマスクをかける
                    mask = torch.full((BOARD_SIZE * BOARD_SIZE,), -float('inf'), device=device)
                    for r, c in valid_moves:
                        mask[r * BOARD_SIZE + c] = 0.0
                    action_idx = (q_values.view(-1) + mask).argmax().item()
                    action = (action_idx // BOARD_SIZE, action_idx % BOARD_SIZE)

            # どちらかのプレイヤーが打つ手がなくなったらエピソード終了
            if action is None:
                break
            
            # AIの行動(player=1)のターンかどうかを記録
            is_ai_turn = env.current_player == 1
            
            # 選択した行動を環境に渡し、次の状態、報酬、終了フラグを受け取る
            observation, reward, done, _ = env.step(action)
            
            # AIのターンに得られた経験だけをReplay Memoryに保存
            if is_ai_turn:
                reward = torch.tensor([reward], device=device)
                next_state = None if done else torch.tensor(observation, dtype=torch.float32, device=device).unsqueeze(0)
                memory.push(state, action, next_state, reward)

            # 次の状態に更新
            state = None if done else torch.tensor(observation, dtype=torch.float32, device=device).unsqueeze(0)
            
            # AIのターンだった場合のみ、モデルの最適化（学習）を実行
            if is_ai_turn:
                optimize_model()

            # ゲームが終了したらエピソードのループを抜ける
            if done:
                break
        
        # ターゲットネットワークの重みをゆっくりと更新する
        target_net_state_dict = target_net.state_dict()
        policy_net_state_dict = policy_net.state_dict()
        for key in policy_net_state_dict:
            target_net_state_dict[key] = policy_net_state_dict[key]*TAU + target_net_state_dict[key]*(1-TAU)
        target_net.load_state_dict(target_net_state_dict)

        # ▼▼▼ チェックポイント保存と、対戦相手プールの更新 ▼▼▼
        if (i_episode + 1) % SAVE_INTERVAL == 0:
            # メインのチェックポイントを保存
            save_path = f"fliptac_dqn_episode_{i_episode+1}.pth"
            torch.save({'policy_net_state_dict': policy_net.state_dict(), 'optimizer_state_dict': optimizer.state_dict(), 'steps_done': steps_done}, save_path)
            
            # 対戦相手プール用のフォルダがなければ作成
            if not os.path.exists(opponent_dir):
                os.makedirs(opponent_dir)
            pool_save_path = os.path.join(opponent_dir, f"opponent_{i_episode+1}.pth")
            
            # 対戦相手も辞書形式で保存する
            torch.save({'policy_net_state_dict': policy_net.state_dict()}, pool_save_path)
            
            # プールが満杯なら一番古いものを削除
            opponent_files = os.listdir(opponent_dir)
            if len(opponent_files) > OPPONENT_POOL_SIZE:
                oldest_file = min(opponent_files, key=lambda f: int(re.search(r'_(\d+)\.pth', f).group(1)))
                os.remove(os.path.join(opponent_dir, oldest_file))
            
            # メモリ内のopponent_poolも更新
            new_opponent = DQN(BOARD_SIZE, BOARD_SIZE).to(device)
            new_opponent.load_state_dict(policy_net.state_dict())
            if len(opponent_pool) >= OPPONENT_POOL_SIZE:
                opponent_pool.pop(0)
            opponent_pool.append(new_opponent)
        # ▲▲▲ ここまで ▲▲▲


    print('Complete')
    torch.save({
        'policy_net_state_dict': policy_net.state_dict(),
        'optimizer_state_dict': optimizer.state_dict(),
        'steps_done': steps_done,
    }, "fliptac_dqn_final.pth")