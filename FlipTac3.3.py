'''
<< FlipTac 基本ルール >>

< 勝利条件 >
・相手が○×を設置できる場所がなくなったら勝利！


< 設置条件 >
・1ターンずつ交互に設置

・自分が最後に設置したマークの周囲8マス

・最後に設置したマークの上下左右に相手のマークがある場合、
  その相手のマークを飛び越えて設置できる（最大1マス分）

    O        O
   XO  -->  XOX
    O        O
  
'''



# プレイ設定
'''
プレイ人数
    3人対戦  >>>  n = 3

    2人対戦  >>>  n = 2

     CPU戦   >>>  n = 1
'''
n = 1

# 盤面の大きさ( size x size )
size = 5

# ダークモード(1で有効)
darkmode = 1





import tkinter as tk
import random
from playsound3 import playsound
import threading
import time


def play_sound(filename):
    playsound(filename)

thread1 = threading.Thread(target=play_sound, args=(r"c:\Users\ryota\OneDrive\デスクトップ\金１プログラミング演習\FlipTac\BGM.mp3",))
thread1.start()


# tkinterの初期化
root = tk.Tk()
root.title('FlipTac')

# 定数設定
buttons = []
board = [[None for _ in range(size)] for _ in range(size)]
marks = ["X", "O", "Δ", "#"]
invalid_marks = []
current_player_idx = 0
last_move = {player: None for player in marks}
cpu_move_count = 0


if n <= 3:
    invalid_marks.append("#")
    if n <= 2:
        invalid_marks.append("Δ")




# プレイヤーの切り替え関数
def switch_player():
    global current_player_idx
    
    current_player_idx = (current_player_idx + 1) % len(marks)
    while marks[current_player_idx] in invalid_marks:
        current_player_idx = (current_player_idx + 1) % len(marks)


# 移動check
def is_valid_move(player, row, col):
    last_pos = last_move[player]
    if last_pos is None:    
        return row == 0 or row == size-1 or col == 0 or col == size-1

    lr, lc = last_pos

    # 隣接移動
    if abs(lr - row) <= 1 and abs(lc - col) <= 1:
        return board[row][col] is None

    # 飛び越え移動
    if lr == row:  # 同じ行
        if abs(lc - col) == 2 and board[row][(lc + col) // 2] not in (None, player):
            return board[row][col] is None
    elif lc == col:  # 同じ列
        if abs(lr - row) == 2 and board[(lr + row) // 2][col] not in (None, player):
            return board[row][col] is None

    return False


# ボタンがクリックされた時の処理
def button_click(row, col):
    global current_player_idx
    player = marks[current_player_idx]
    if board[row][col] is None and is_valid_move(player, row, col):
        board[row][col] = player
        last_move[player] = (row, col)
        switch_player()
        update_board()
        settle()

        # COMの手番
        if n == 1 and current_player_idx == 0:            
            cpu_move()


# 詰み判定
def check_no_moves(player):
    for row in range(size):
        for col in range(size):
            if board[row][col] is None and is_valid_move(player, row, col):
                return False
    return True


# 勝利判定
def settle():
    if check_no_moves(marks[current_player_idx]):
        invalid_marks.append(marks[current_player_idx])
        if len(invalid_marks) == 3:
            switch_player()
            winner = marks[current_player_idx]
            display_winner(winner)
        else:
            switch_player()
            update_board()
            settle()


# 勝利画面
def display_winner(winner):
    win_font = ("Bahnschrift Condensed", 50)
    csize = 300
    overlay = tk.Canvas(root, width=csize, height=csize//2)
    overlay.create_rectangle(0, 0, csize, csize, fill="#dbd0e6", outline="")
    overlay.create_text(csize // 2, csize // 4, text=f"{winner} wins!", font=win_font, fill="#2b2b2b")
    overlay.place(x=root.winfo_reqwidth() // 2 - csize // 2, y=root.winfo_reqheight() // 2 - csize // 4)

    thread2 = threading.Thread(target=play_sound, args=(r"c:\Users\ryota\OneDrive\デスクトップ\金１プログラミング演習\FlipTac\win.mp3",))
    thread2.start()


# cpuの移動
def cpu_move():
    global cpu_move_count
    start = time.time()
    wait = True
    while wait:
        now = time.time()
        if now - start > 0.1:
            wait = False

    if cpu_move_count < 3:
        empty_tiles = []
        for row in range(size):
            for col in range(size):
                if board[row][col] == None and is_valid_move(marks[current_player_idx], row, col):
                    empty_tiles.append((row,col))
        row, col = random.choice(empty_tiles)
    else:
        row, col = shortest()

    board[row][col] = "X"
    last_move["X"] = (row, col)
    cpu_move_count += 1
    switch_player()
    update_board()
    settle()


# 最短距離の手を計算する関数
def shortest():
    opponent = "O" if current_player_idx == 0 else "X"
    valid_moves = [(row, col) for row in range(size) for col in range(size)
                   if board[row][col] is None and is_valid_move(marks[current_player_idx], row, col)]
    if valid_moves:
        move_counts = []
        for move in valid_moves:
            row, col = move
            board[row][col] = marks[current_player_idx]
            last_move[marks[current_player_idx]] = (row, col)
            move_count = count_valid_moves(opponent)
            move_counts.append((move_count, move))
            board[row][col] = None

        # 相手が最後にマークを置いた位置
        last_opponent_move = last_move[opponent]

        # 最小の move_count を持つ手を見つける
        min_moves = min(move_counts, key=lambda x: x[0])[0]

        # move_counts から min_moves と同じ数を持つ最良の手を抽出
        best_moves = [move for count, move in move_counts if count == min_moves]

        # 最短距離の手を見つける
        min_dist = float('inf')
        best_move_shortest = None
        for move in best_moves:
            row, col = move
            dist = (last_opponent_move[0] - row)**2 + (last_opponent_move[1] - col)**2
            if dist < min_dist:
                min_dist = dist
                best_move_shortest = move

        return best_move_shortest

    return None


# 有効手の数を数える関数
def count_valid_moves(player):
    count = 0
    for row in range(size):
        for col in range(size):
            if board[row][col] is None and is_valid_move(player, row, col):
                count += 1
    return count


# ゲーム画面の更新
def update_board():
    for row in range(size):
        for col in range(size):
            if board[row][col] is not None:
                buttons[row * size + col].config(text=board[row][col])
            if board[row][col] == "X":
                color = '#89c3eb'
            elif board[row][col] == "O":
                color = '#f6ad49'
            elif board[row][col] == "Δ":
                color = '#fef263'
            elif board[row][col] is None and is_valid_move(marks[current_player_idx], row, col):
                color = '#b8d200' if darkmode == 1 else '#99ff99'
            else:
                color = '#2e2930' if darkmode == 1 else '#fdeffb'
            buttons[row * size + col].config(bg=color)

            # 最後に置かれたマークの色を変更
            for player in marks:
                if last_move[player]:
                    lr, lc = last_move[player]
                    if player == "X":
                        color = '#2ca9e1'
                    elif player == "O":
                        color = '#f08300'
                    elif player == "Δ":
                        color = '#ffd900'
                    buttons[lr * size + lc].config(bg=color)


# ボタンとラベルの配置
for row in range(size):
    for col in range(size):
        button = tk.Button(root, text='', font=('Bahnschrift', 180//size), width=3, height=1,
                           command=lambda row=row, col=col: button_click(row, col))
        button.grid(row=row, column=col)
        buttons.append(button)


# メインループ
update_board()
if n == 1:
    cpu_move()
root.mainloop()


