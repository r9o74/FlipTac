import torch
import torch.optim as optim
import torch.nn as nn
import torch.nn.functional as F
import random
import math
from collections import namedtuple, deque
from itertools import count

from FlipTacEnv import FlipTacEnv
from model import DQN

# --- 設定 ---
BATCH_SIZE = 128
GAMMA = 0.99
EPS_START = 0.9
EPS_END = 0.05
EPS_DECAY = 10000
TAU = 0.005
LR = 1e-4
BOARD_SIZE = 7
NUM_EPISODES = 10000

# --- Replay Memory ---
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

# --- 初期化 ---
env = FlipTacEnv(size=BOARD_SIZE)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

policy_net = DQN(BOARD_SIZE, BOARD_SIZE).to(device)
target_net = DQN(BOARD_SIZE, BOARD_SIZE).to(device)
target_net.load_state_dict(policy_net.state_dict())
target_net.eval()

optimizer = optim.AdamW(policy_net.parameters(), lr=LR, amsgrad=True)
memory = ReplayMemory(10000)

steps_done = 0

def select_action(state):
    """ ε-greedy法で行動を選択する """
    global steps_done
    sample = random.random()
    eps_threshold = EPS_END + (EPS_START - EPS_END) * \
        math.exp(-1. * steps_done / EPS_DECAY)
    steps_done += 1
    if sample > eps_threshold:
        with torch.no_grad():
            q_values = policy_net(state)
            # 有効な手の中からQ値が最大の手を選ぶ
            valid_moves = env.get_valid_moves(env.current_player)
            if not valid_moves: return None
            
            # 無効な手に対応するQ値を-無限大に設定
            mask = torch.full((BOARD_SIZE * BOARD_SIZE,), -float('inf'), device=device)
            for r, c in valid_moves:
                mask[r * BOARD_SIZE + c] = 0.0
            
            action_q_values = q_values.view(-1) + mask
            action_idx = action_q_values.argmax().item()
            return (action_idx // BOARD_SIZE, action_idx % BOARD_SIZE)

    else:
        # ランダムに行動を選択
        valid_moves = env.get_valid_moves(env.current_player)
        return random.choice(valid_moves) if valid_moves else None

def optimize_model():
    """ 経験からモデルを最適化する """
    if len(memory) < BATCH_SIZE:
        return
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

# --- 学習ループ ---
for i_episode in range(NUM_EPISODES):
    state = env.reset()
    state = torch.tensor(state, dtype=torch.float32, device=device).unsqueeze(0)
    
    for t in count():
        action = select_action(state)
        
        if action is None: # 打てる手がない
            break

        observation, reward, done, _ = env.step(action)
        reward = torch.tensor([reward], device=device)
        
        if done:
            next_state = None
        else:
            next_state = torch.tensor(observation, dtype=torch.float32, device=device).unsqueeze(0)

        memory.push(state, action, next_state, reward)
        state = next_state
        
        optimize_model()

        # ターゲットネットワークの重みを更新
        target_net_state_dict = target_net.state_dict()
        policy_net_state_dict = policy_net.state_dict()
        for key in policy_net_state_dict:
            target_net_state_dict[key] = policy_net_state_dict[key]*TAU + target_net_state_dict[key]*(1-TAU)
        target_net.load_state_dict(target_net_state_dict)

        if done:
            break
            
    if (i_episode + 1) % 100 == 0:
        print(f"Episode {i_episode+1}/{NUM_EPISODES} finished.")
        # 100エピソードごとにモデルを保存
        torch.save(policy_net.state_dict(), f"fliptac_dqn_episode_{i_episode+1}.pth")

print('Complete')
torch.save(policy_net.state_dict(), "fliptac_dqn_final.pth")
