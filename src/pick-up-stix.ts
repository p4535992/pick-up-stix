/**
 * This is your TypeScript entry file for Foundry VTT.
 * Register custom settings, sheets, and constants using the Foundry API.
 * Change this heading to be more descriptive to your module, or remove it.
 * Author: [your name]
 * Content License: [copyright and-or license] If using an existing system
 * 					you may want to put a (link to a) license or copyright
 * 					notice here (e.g. the OGL).
 * Software License: [your license] Put your desired license here, which
 * 					 determines how others may use and modify your module
 */

// Import TypeScript modules
import { registerSettings } from './module/settings.js';
import { preloadTemplates } from './module/preloadTemplates.js';

export type FormData = [string, number];

export interface PickUpStixFlags {
	itemIds: FormData[];
	isContainer: boolean;
	imageContainerClosedPath: string;
	imageContainerOpenPath: string;
	isOpen: boolean;
}

/**
 * Application class to display to select an item that the token is
 * associated with
 */
class SelectItemApplication extends Application {
	static created: boolean = false;

	private _flags: PickUpStixFlags;

	private get isContainer(): boolean {
		return this._flags.isContainer;
	}
	private set isContainer(value: boolean) {
		this._flags.isContainer = value;
	}

	private get imageContainerOpenPath(): string {
		return this._flags.imageContainerOpenPath;
	}
	private set imageContainerOpenPath(value: string) {
		this._flags.imageContainerOpenPath = value;
	}

	private get imageContainerClosedPath(): string {
		return this._flags.imageContainerClosedPath;
	}
	private set imageContainerClosedPath(value: string) {
		this._flags.imageContainerClosedPath = value;
	}

	private get selectionData(): FormData[] {
		return this._flags.itemIds;
	}
	private set selectionData(value: FormData[]) {
		this._flags.itemIds = [
			...value
		];
	}

	private _html: any;

	static get defaultOptions(): ApplicationOptions {
	  const options = super.defaultOptions;
    options.id = "pick-up-stix-selectItem";
	  options.template = "modules/pick-up-stix/templates/select-item.html";
		options.width = 500;
		options.height = 'auto';
		options.minimizable = false;
		options.title = "Select an Item";
		options.resizable = true;
    return options;
	}

	constructor(private _token: Token) {
		super({});
		console.log(`pick-up-stix | select item form | constructed with args:`)
		console.log(this._token);

		const flags = this._token.getFlag('pick-up-stix', 'pick-up-stix');
		this._flags = flags ? duplicate(flags) : { itemIds: [], isContainer: false, imageContainerPath: undefined, isOpen: false };

		console.log(`pick-up-stix | select item form | constructed with flags`);
		console.log(this._flags);
	}

	private async setSelectionAmount(id: string, count: number): Promise<FormData> {
		let currItemData = this.selectionData.find(itemData => itemData[0] === id);

		if (currItemData) {
			currItemData[1] = count;
			console.log(`Previous value existed, setting ${currItemData[0]} to count ${currItemData[1]}`);
		}
		else {
			currItemData = [id, 1];
			this.selectionData.push(currItemData);
			console.log(`Adding item ${currItemData[0]} with count ${currItemData[1]}`);
		}

		return currItemData;
	}

	activateListeners(html) {
		this._html = html;
		super.activateListeners(this._html);

		console.log(`pick-up-stix | selection form setup | current selection data`);
		console.log(this.selectionData);

		this.selectionData?.forEach(itemData => {
			console.log(`pick-up-stix | selection from setup | setting item ${itemData[0]} to active and count to ${itemData[1]}`);
			const item = $(this._html).find(`[data-item-id="${itemData[0]}"]`);
			if (itemData[1] > 0) {
				item.addClass('active');
			}
			item.find('.count').val(itemData[1]);
		});

		/**
		 * Listen on the file input for when it's clicked. prevent the default dialog from
		 * opening and open the Foundry FilePicker
		 */
		$(this._html).find('input[type="file"]').click(e => {
			e.preventDefault();

			const openDialog = $(e.currentTarget).hasClass('open');

			const fp = new FilePicker({
				type: 'image',
				callback: path => {
					console.log(`pick-up-stix | file picker picked | setting container image ${openDialog ? 'open' : 'closed'} path to ${path}`);

					if (openDialog) {
						this.imageContainerOpenPath = path;
					}
					else {
						this.imageContainerClosedPath = path;
					}

					this.render();
				}
			}).browse((openDialog ? this.imageContainerOpenPath : this.imageContainerClosedPath) ?? '');
		});

		/**
		 * Listen for the container checkbox change event
		 */
		$(this._html).find('.file-input-checkbox').change(async (e) => {
			console.log(`pick-up-stix | select form | file input check box changed`);
			this.isContainer = !this.isContainer;
			this.render();
		});

		/**
		 * Listen for the change event on the count input
		 */
		$(this._html).find('.item .count').change(async (e) => {
			const count = +$(e.currentTarget).val();
			const id = $(e.currentTarget).parent().attr('data-item-id');
			console.log(`pick-up-stix | selection from count input changed | Setting item ${id} to count ${count}`);
			if (count === 0) {
				$(this._html).find(`[data-item-id="${id}"]`).removeClass('active');
			}
			else if(count > 0) {
				$(this._html).find(`[data-item-id="${id}"]`).addClass('active');
			}
			await this.setSelectionAmount(id, count);
		});

		/**
		 * Listen for clicks on each item's image and increment the item's count by one
		 */
		$(this._html).find('.item img').click(async (e) => {
			const item = $(e.currentTarget).parent();
			const itemId = item.attr('data-item-id');

			let currItemData = this.selectionData.find(itemData => itemData[0] === itemId);
			currItemData = await this.setSelectionAmount(itemId, currItemData ? currItemData[1] + 1 : 1);
			item.find('.count').val(currItemData[1]);
			console.log(`pick-up-stix | selection form image clicked | setting item ${itemId} to count ${currItemData[1]}`);
			item.addClass('active');
			this.render();
		});
	}

	getData(): any {
		return {
			options: this.options,
			object: {
				items: duplicate(Array.from(game.items)),
				isContainer: this.isContainer,
				imageContainerOpenPath: this.imageContainerOpenPath,
				imageContainerClosedPath: this.imageContainerClosedPath
			}
		}
	}

	async close() {
		const flags: PickUpStixFlags = {
			...this._flags
		}

		const update = {
			img: flags.isOpen ? flags.imageContainerOpenPath : flags.imageContainerClosedPath,
			flags: {
				'pick-up-stix': {
					'pick-up-stix': {
						...flags
					}
				}
			}
		}
		await this._token.update(update);
		// await this._token.setFlag('pick-up-stix', 'pick-up-stix', flags);
		super.close();
	}
}

/* ------------------------------------ */
/* Initialize module					*/
/* ------------------------------------ */
Hooks.once('init', async function() {
	CONFIG.debug.hooks = true;

	Canvas.prototype._onDrop = handleOnDrop;

	console.log('pick-up-stix | Init pick-up-stix');

	// Assign custom classes and constants here

	// Register custom module settings
	registerSettings();

	// Preload Handlebars templates
	await preloadTemplates();

	// Register custom sheets (if any)
});

/* ------------------------------------ */
/* Setup module							*/
/* ------------------------------------ */
Hooks.once('setup', function() {
	// Do anything after initialization but before
	// ready
	console.log(`pick-up-stix | Setup`);
});

Hooks.once('canvasReady', function() {
	console.log(`pick-up-stix | Canvas ready, adding PickUpStixItemLayer`);
});

/* ------------------------------------ */
/* When ready													  */
/* ------------------------------------ */
Hooks.once('ready', function() {
	// Do anything once the module is ready
	console.log(`pick-up-stix | ready hook`);

	canvas?.tokens?.placeables?.forEach(async (p: PlaceableObject) => {
		const data: PickUpStixFlags = p.getFlag('pick-up-stix', 'pick-up-stix') || [];

		if (data?.itemIds?.length > 0) {
			console.log(`pick-up-stix | ready hook | found token ${p.id} with itemIds`);
			p.on('mousedown', handleTokenItemClicked);
		}
	});

	(game.socket as any).on('module.pick-up-stix', (...args) => {
		console.log(`pick-up-stix | received socket message with args:`);
		console.log(args);
	});

	(game.socket as any).emit('module.pick-up-stix', 'you guessed it!');
});

Hooks.on('renderTokenHUD', (hud: TokenHUD, hudHtml: JQuery, data: any) => {
	const token: Token = canvas.tokens.placeables.find(p => p.id === data._id);

	// TODO when you get to dropping an item, check for a flag here to determine
	// the token can actually be picked up

	if (!data.isGM) {
		return;
	}

	const controlIcon = document.createElement('div');
	controlIcon.className = 'control-icon';
	const img = document.createElement('img');
	img.src = token.getFlag('pick-up-stix', 'pick-up-stix.itemIds')?.length
		? 'modules/pick-up-stix/assets/pick-up-stix-icon-white.svg'
		: 'modules/pick-up-stix/assets/pick-up-stix-icon-black.svg';
	img.className = "item-pick-up";

	controlIcon.addEventListener('mousedown', toggleItemPickup(hud, img, data));
	controlIcon.appendChild(img);
	$(hudHtml.children('div')[0]).prepend(controlIcon);
});

function toggleItemPickup(hud: TokenHUD, img: HTMLImageElement, tokenData: any): (this: HTMLDivElement, ev: MouseEvent) => any {
	return async function(this, ev: MouseEvent) {
		console.log(`pick-up-sticks | toggle icon clicked`);
		const token: Token = canvas?.tokens?.placeables?.find((p: PlaceableObject) => p.id === tokenData._id);
		if (!token) {
			console.log(`pick-up-sticx | Couldn't find token '${tokenData._id}'`);
			return;
		}

		const flags: PickUpStixFlags = token.getFlag('pick-up-stix', 'pick-up-stix');

		if (flags?.itemIds?.length > 0) {
			console.log(`pick-up-stix | token already has itemIds ${flags?.itemIds}`);
		}

		let b = new SelectItemApplication(token);
		b.render(true);
	}
}

Hooks.on('updateToken', (scene: Scene, tokenData: any, tokenFlags: any, userId: string) => {
	console.log(`pick-up-stix | updateToken`)
	const token: Token = canvas?.tokens?.placeables?.find((p: PlaceableObject) => p.id === tokenData._id);
	token.off('mousedown');

	const itemIds = token.getFlag('pick-up-stix', 'pick-up-stix.itemIds');
	if (itemIds?.length) {
		setTimeout(() => {
			token.on('mousedown', handleTokenItemClicked);
			console.log(`pick-up-stix | update token | itemIds ${itemIds}`);
		}, 100);
	}
});
Hooks.on('createToken', async (scene: Scene, tokenData: any, options: any, userId: string) => {
	console.log(`pick-up-stix | create token`)
	const token: Token = canvas?.tokens?.placeables?.find((p: PlaceableObject) => p.id === tokenData._id);

	const itemIds: FormData[] = token.getFlag('pick-up-stix', 'pick-up-stix.itemIds');
	if (itemIds?.length) {
		// TODO not really sure why but for some reason adding a mousdown hook to the token doesn't work
		// in the create hook so have to set a timeout and put it in there. Maybe a redraw issue or some
		// timing issue I don't know about in the framework
		setTimeout(() => {
			token.on('mousedown', handleTokenItemClicked);
			console.log(`pick-up-stix | create token | itemIds ${itemIds}`);
		}, 100);
	}
});


// WARNING: Overwritten from foundry method in order to be able to drop actor data. This is the Canvas
// on drop handler
//
// TODO 0.7.0 of Foundry should all for better drop handling so switch to that when it's
// available
async function handleOnDrop(event) {
	console.log(`pick-up-stix | handleOnDrop with args:`);
	console.log(event);
	event.preventDefault();

	// Try to extract the data
	let data;
	try {
		data = JSON.parse(event.dataTransfer.getData('text/plain'));
	}
	catch (err) {
		return false;
	}

	// Acquire the cursor position transformed to Canvas coordinates
	const [x, y] = [event.clientX, event.clientY];
	const t = this.stage.worldTransform;
	data.x = (x - t.tx) / canvas.stage.scale.x;
	data.y = (y - t.ty) / canvas.stage.scale.y;

	// Dropped Actor
	if ( data.type === "Actor" ) canvas.tokens._onDropActorData(event, data);

	// Dropped Journal Entry
	else if ( data.type === "JournalEntry" ) canvas.notes._onDropData(event, data);

	// Dropped Macro (clear slot)
	else if ( data.type === "Macro" ) {
		game.user.assignHotbarMacro(null, data.slot);
	}

	// Dropped Tile artwork
	else if ( data.type === "Tile" ) {
		return canvas.tiles._onDropTileData(event, data);
	}
	// Dropped Item
	else if (data.type === "Item") {
		const item: Item = game.items.get(data.id);
		await Token.create({
			bar1: {	},
			img: item.img,
			name: item.name,
			x: data.x,
			y: data.y,
			disposition: 0,
			flags: {
				'pick-up-stix': {
					'pick-up-stix': {
						originalImagePath: item.img,
						itemIds: [
							[data.id, 1]
						]
					}
				}
			}
		});
	}
}

async function handleTokenItemClicked(e): Promise<void> {
	console.log(`pick-up-stix | handleTokenItemClicked | ${this.id}`);

	if (e.currentTarget.data.hidden) {
		return;
	}

	const tokens = (canvas.tokens as TokenLayer).controlled;
	if (tokens.length !== 1 || tokens[0]?.getFlag('pick-up-stix', 'pick-up-stix.itemIds')?.length > 0) {
		ui.notifications.error('You must be controlling only one token to pick up an item');
		return;
	}

	const flags: PickUpStixFlags = duplicate(this.getFlag('pick-up-stix', 'pick-up-stix'));
	if(flags.isContainer) {
		console.log(`pick-up-stix | handleTokenItemClicked | item is a container`);
		flags.isOpen = !flags.isOpen;
		setTimeout(() => {
			const data = {
				img: flags.isOpen ? flags.imageContainerOpenPath : flags.imageContainerClosedPath,
				flags: {
					'pick-up-stix': {
						'pick-up-stix': {
							...flags
						}
					}
				}
			};
			console.log(data);
			this.update(data);
		}, 100);

		return;
	}

	let itemDatas: FormData[] = this.getFlag('pick-up-stix', 'pick-up-stix.itemIds');
	const token = tokens[0];

	let datas = itemDatas.reduce((accumulator, next) => {
		const item = game.items.get(next[0]);
		const datas = [];
		for (let i = 0; i < next[1]; i++) {
			datas.push({
				...item.data
			});
		}
		return accumulator.concat(datas);
	}, []);
	await token?.actor.createEmbeddedEntity('OwnedItem', datas);
	await canvas.scene.deleteEmbeddedEntity('Token', this.id);
}
