import numpy as np
import random

class FlipTacEnv:
    """
    FlipTacのゲーム環境クラス
    強化学習の標準的なインターフェース（reset, step）を提供します。
    """
    def __init__(self, size=7):
        self.size = size
        self.marks = {1: 'X', -1: 'O'} # 1: AI, -1: Opponent
        self.reset()

    def reset(self):
        """ ゲームの状態を初期化する """
        self.board = np.zeros((self.size, self.size), dtype=int)
        self.last_move = {1: None, -1: None}
        self.current_player = 1 # AI (X) starts
        return self._get_state()

    def _get_state(self):
        """
        ニューラルネットワークへの入力となる状態を返す。
        Channel 0: 自分の石の位置
        Channel 1: 相手の石の位置
        Channel 2: 現在のプレイヤー（全面1 or -1）
        """
        state = np.zeros((3, self.size, self.size), dtype=np.float32)
        state[0, self.board == self.current_player] = 1.0
        state[1, self.board == -self.current_player] = 1.0
        state[2, :, :] = self.current_player # 現在のプレイヤー情報を全面に付与
        return state

    def get_valid_moves(self, player):
        """ 指定されたプレイヤーの有効な手をすべてリストアップする """
        moves = []
        for r in range(self.size):
            for c in range(self.size):
                if self.is_valid_move(player, r, c):
                    moves.append((r, c))
        return moves

    def is_valid_move(self, player, row, col):
        """ 特定の手が有効かどうかを判定する """
        if self.board[row, col] != 0:
            return False

        last_pos = self.last_move[player]
        if last_pos is None:
            return row == 0 or row == self.size - 1 or col == 0 or col == self.size - 1

        lr, lc = last_pos
        if abs(lr - row) <= 1 and abs(lc - col) <= 1:
            return True

        if lr == row and abs(lc - col) == 2:
            jump_over_pos = self.board[row, (lc + col) // 2]
            return jump_over_pos != 0 and jump_over_pos != player
        elif lc == col and abs(lr - row) == 2:
            jump_over_pos = self.board[(lr + row) // 2, col]
            return jump_over_pos != 0 and jump_over_pos != player
        
        return False

    def step(self, action):
        """
        行動を実行し、次の状態、報酬、ゲーム終了フラグを返す
        action: (row, col) のタプル
        """
        row, col = action
        player = self.current_player

        if not self.is_valid_move(player, row, col):
            # 無効な手を選んだ場合、大きな負の報酬を与えてゲームを即終了
            return self._get_state(), -10.0, True, {}

        self.board[row, col] = player
        self.last_move[player] = (row, col)
        
        # 相手のターンに切り替え
        self.current_player *= -1
        opponent = self.current_player

        # 勝利判定
        opponent_valid_moves = self.get_valid_moves(opponent)
        done = False
        reward = 0.0

        if not opponent_valid_moves:
            done = True
            reward = 1.0 # 勝利！
        
        # 1手ごとに小さな負の報酬を与え、早く勝つことを促す（任意）
        reward -= 0.01

        return self._get_state(), reward, done, {}
