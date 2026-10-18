"""Publication figures from the descriptive analysis; never modifies inputs."""
import json
import sys
from pathlib import Path

# Optional workspace-only installation, without changing the bundled runtime.
local_deps = Path(__file__).resolve().parents[1] / 'tmp/analysis-python-deps'
if local_deps.exists():
    sys.path.insert(0, str(local_deps))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator

root = Path(sys.argv[1])
data = json.loads((root / 'analysis.json').read_text(encoding='utf-8'))
out = root / 'figures'
out.mkdir(exist_ok=True)
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 11, 'axes.spines.top': False, 'axes.spines.right': False, 'svg.fonttype': 'none', 'savefig.dpi': 180})
colors = ['#087F8C', '#AE426A']

def save(fig, name):
    fig.savefig(out / (name + '.svg'), bbox_inches='tight', metadata={'Date': None})
    fig.savefig(out / (name + '.png'), bbox_inches='tight')
    plt.close(fig)

def ecdf(fields, labels, title, xlabel, name, percent=False):
    fig, ax = plt.subplots(figsize=(8, 4.5), layout='constrained')
    for field, label, color in zip(fields, labels, colors):
        x = sorted(r[field] * (100 if percent else 1) for r in data['rows'] if r[field] is not None)
        if x:
            ax.step(x, [(i+1)/len(x) for i in range(len(x))], where='post', lw=2, color=color, label=f'{label} (n={len(x)})')
    if not percent:
        ax.set_xscale('symlog', linthresh=1, linscale=1)
        xlabel += '\nEscala symlog: linear até 1; logarítmica acima de 1'
    else:
        ax.set_xlim(0, 100)
    ax.set_ylim(0, 1.02)
    ax.set_xlabel(xlabel)
    ax.set_ylabel('Proporção acumulada de repositórios')
    ax.set_title(title, loc='left', weight='bold')
    ax.grid(alpha=.18)
    ax.legend(loc='lower right', frameon=False)
    save(fig, name)

ecdf(['deployment_frequency'], ['Releases por semana'], 'RQ 01 | Frequência de releases', 'Releases / semana', 'rq01-frequency')
ecdf(['lead_time_release_median_hours','lead_time_commit_median_hours'], ['Por release (a)','Por commit (b)'], 'RQ 02 | Distribuição das medianas de lead time', 'Horas', 'rq02-lead-time')
ecdf(['cfr_ci','cfr_b'], ['CFR CI (a)','CFR entrega (b), exploratório'], 'RQ 03 | Taxas por repositório', 'Taxa (%)', 'rq03-cfr', percent=True)
ecdf(['recovery_median_hours'], ['Recuperação observada'], 'RQ 04 | Medianas dos episódios recuperados', 'Horas', 'rq04-recovery')
ecdf(['censored_fraction'], ['Fração censurada'], 'RQ 04 | Episódios sem recuperação na janela', 'Taxa (%)', 'rq04-censoring', percent=True)

fig, axes = plt.subplots(1, 2, figsize=(10, 4.5), layout='constrained')
for ax, scope, title in zip(axes, ['complete','available'], ['C1 completa: quatro dimensões','C1 disponível: exploratória']):
    values=data['c1'][scope+'_distribution']
    bars=ax.bar([v['category'] for v in values], [v['n'] for v in values], color=['#8B4F4F','#C68C44','#428B91','#24566C'])
    ax.bar_label(bars, padding=3)
    ax.set_ylim(0, max(v['n'] for v in values)*1.18+1)
    ax.yaxis.set_major_locator(MaxNLocator(integer=True))
    ax.set_ylabel('Repositórios')
    ax.set_title(title, fontsize=11)
fig.suptitle(f"Referência C1 | {data['c1']['complete_n']} completos; {data['c1']['partial_n']} parciais", weight='bold')
save(fig, 'c1-classification')
print('Gráficos gerados:', len(list(out.glob('*.png'))))
